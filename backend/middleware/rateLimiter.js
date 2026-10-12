import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../config/redis.js';

/**
 * Helper to build rate limit store: uses Redis when active, falls back to memory
 */
const createStore = (prefix) => {
  const client = getRedisClient();
  if (isRedisConnected() && client) {
    try {
      return new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix: `chatapp:rl:${prefix}:`,
      });
    } catch (err) {
      console.warn(`[RATE LIMIT] Failed to bind Redis store for ${prefix}:`, err.message);
    }
  }
  // undefined defaults to in-memory store
  return undefined;
};

/**
 * Strict limiter for sensitive Auth & OTP endpoints (prevent SMS/Email cost drain & spam)
 * 10 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('auth'),
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  },
});

/**
 * Rate limiter for message creation / sending
 * 60 requests per minute per IP / user
 */
export const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('msg'),
  message: {
    success: false,
    message: 'Message rate limit exceeded. Please slow down your requests.',
  },
});

/**
 * General API Limiter
 * 300 requests per 15 minutes
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('general'),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
