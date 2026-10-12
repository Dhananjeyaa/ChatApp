import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// ─── ioredis Configuration ────────────────────────────────────────────────────
// Configured to prevent process crashes, disable offline queuing, and failover gracefully
const redisOptions = {
  maxRetriesPerRequest: null, // Required to prevent MaxRetriesPerRequestError
  enableOfflineQueue: false,  // Disables command buffering when Redis is disconnected
  lazyConnect: true,          // Allows manual and guarded connection initialization
  connectTimeout: 2000,
  disconnectTimeout: 2000,
  retryStrategy(times) {
    // Quickly fallback in local development if Redis is not running
    if (times > 2) {
      return null; // Stop retrying and remain in in-memory mode
    }
    return 1000;
  },
};

let redisClient = null;
let redisSubClient = null;
let isConnected = false;
let hasWarned = false;

// In-memory fallback stores when Redis is offline
const memoryOnlineUsers = new Set();
const memoryUserSockets = new Map();
const memoryUserLastSeen = new Map();

const handleRedisError = (label) => (err) => {
  isConnected = false;
  if (!hasWarned) {
    hasWarned = true;
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('connect')) {
      console.warn(
        `\x1b[33m[REDIS]\x1b[0m Redis server not detected at ${REDIS_URL}. Operating seamlessly in In-Memory fallback mode.`
      );
    } else {
      console.warn(`\x1b[33m[REDIS]\x1b[0m ${label} error:`, err.message);
    }
  }
};

try {
  redisClient = new Redis(REDIS_URL, redisOptions);
  redisSubClient = new Redis(REDIS_URL, redisOptions);

  // Attach explicit error handlers to ALL instances to eliminate unhandled error crashes
  redisClient.on('error', handleRedisError('redisClient'));
  redisSubClient.on('error', handleRedisError('redisSubClient'));

  redisClient.on('ready', () => {
    isConnected = true;
    hasWarned = false;
    console.log('\x1b[32m[REDIS]\x1b[0m Connected to Redis instance successfully.');
  });

  redisSubClient.on('ready', () => {
    // Sub-client ready for socket pub/sub
  });

  // Attempt initial connect silently with catch block
  redisClient.connect().catch(() => {});
  redisSubClient.connect().catch(() => {});
} catch (err) {
  console.warn(
    '\x1b[33m[REDIS]\x1b[0m Failed to initialize Redis clients. Operating in In-Memory fallback mode:',
    err.message
  );
}

// Client accessors & aliases
export const getRedisClient = () => redisClient;
export const getRedisSubClient = () => redisSubClient;
export const pubClient = redisClient;
export const subClient = redisSubClient;

export const isRedisConnected = () =>
  isConnected && redisClient !== null && redisClient.status === 'ready';

/**
 * Socket.IO Redis Adapter Factory (only active when Redis is verified ready)
 */
export const getSocketRedisAdapter = () => {
  if (isRedisConnected() && redisClient && redisSubClient) {
    try {
      return createAdapter(redisClient, redisSubClient);
    } catch (adapterErr) {
      console.warn('[REDIS ADAPTER] Failed to create adapter:', adapterErr.message);
    }
  }
  return null;
};

// ─── Redis Presence & Socket Mapping Store (with zero-lag in-memory fallback) ──
const PREFIX = 'chatapp:presence:';

/**
 * Map a user's socket and track online presence
 */
export const setUserOnline = async (userId, socketId) => {
  if (!userId || !socketId) return;

  if (isRedisConnected()) {
    try {
      const pipeline = redisClient.pipeline();
      pipeline.sadd(`${PREFIX}online_users`, userId);
      pipeline.sadd(`${PREFIX}user_sockets:${userId}`, socketId);
      pipeline.hset(`${PREFIX}user:${userId}`, 'status', 'online', 'lastActive', Date.now());
      await pipeline.exec();
      return;
    } catch (err) {
      console.warn('[REDIS Presence Error] fallback to memory:', err.message);
    }
  }

  // Resilient In-memory fallback
  memoryOnlineUsers.add(userId);
  if (!memoryUserSockets.has(userId)) memoryUserSockets.set(userId, new Set());
  memoryUserSockets.get(userId).add(socketId);
};

/**
 * Remove socket mapping and determine if user is fully offline
 */
export const removeUserSocket = async (userId, socketId) => {
  if (!userId || !socketId) return { isFullyOffline: true };

  if (isRedisConnected()) {
    try {
      await redisClient.srem(`${PREFIX}user_sockets:${userId}`, socketId);
      const remainingSockets = await redisClient.scard(`${PREFIX}user_sockets:${userId}`);

      if (remainingSockets === 0) {
        const lastSeen = new Date().toISOString();
        const pipeline = redisClient.pipeline();
        pipeline.srem(`${PREFIX}online_users`, userId);
        pipeline.hset(`${PREFIX}user:${userId}`, 'status', 'offline', 'lastSeen', lastSeen);
        await pipeline.exec();
        return { isFullyOffline: true, lastSeen };
      }
      return { isFullyOffline: false };
    } catch (err) {
      console.warn('[REDIS Presence Error] fallback to memory:', err.message);
    }
  }

  // Resilient In-memory fallback
  const set = memoryUserSockets.get(userId);
  if (!set) return { isFullyOffline: true };
  set.delete(socketId);
  if (set.size === 0) {
    memoryUserSockets.delete(userId);
    memoryOnlineUsers.delete(userId);
    const lastSeen = new Date().toISOString();
    memoryUserLastSeen.set(userId, lastSeen);
    return { isFullyOffline: true, lastSeen };
  }
  return { isFullyOffline: false };
};

/**
 * Get all currently active/online user IDs
 */
export const getOnlineUserIds = async () => {
  if (isRedisConnected()) {
    try {
      const userIds = await redisClient.smembers(`${PREFIX}online_users`);
      return userIds || [];
    } catch (err) {
      console.warn('[REDIS Presence Error] fallback to memory:', err.message);
    }
  }

  return Array.from(memoryOnlineUsers);
};

/**
 * Check if a specific user is currently online
 */
export const isUserOnline = async (userId) => {
  if (!userId) return false;

  if (isRedisConnected()) {
    try {
      const isMember = await redisClient.sismember(`${PREFIX}online_users`, userId);
      return Boolean(isMember);
    } catch (err) {
      console.warn('[REDIS Presence Error] fallback to memory:', err.message);
    }
  }

  return memoryOnlineUsers.has(userId);
};
