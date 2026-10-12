import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { getConversationId } from '../utils/chatUtils.js';
import {
  getSocketRedisAdapter,
  setUserOnline,
  removeUserSocket,
  getOnlineUserIds,
  isUserOnline,
} from '../config/redis.js';

export const initSocket = (server) => {
  const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10MB limit for voice note data transmission
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach Redis Adapter only when Redis is verified ready
  const adapter = getSocketRedisAdapter();
  if (adapter) {
    try {
      io.adapter(adapter);
      console.log('\x1b[32m[SOCKET.IO]\x1b[0m Redis Adapter configured for horizontal clustering.');
    } catch (adapterErr) {
      console.warn('\x1b[33m[SOCKET.IO]\x1b[0m Redis Adapter setup deferred:', adapterErr.message);
    }
  }

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
      if (!token) return next(new Error('Authentication error: No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded._id;
      if (!userId) return next(new Error('Authentication error: Invalid token'));

      const user = await User.findById(userId)
        .select('_id name email phone profilePic status')
        .lean();
      if (!user) return next(new Error('Authentication error: User not found'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    if (!socket.user?._id) return;
    const userId = socket.user._id.toString();

    // 1. In-Memory / Redis Caching of User Presence & Socket Mapping
    await setUserOnline(userId, socket.id);
    socket.join(`user:${userId}`);

    try {
      const onlineUserIds = await getOnlineUserIds();
      io.emit('getOnlineUsers', onlineUserIds);
      io.emit('userStatusChanged', { userId, status: 'online' });
    } catch (err) {
      console.error('Error broadcasting online status:', err.message);
    }

    // 2. Join/leave chat room
    socket.on('joinChat', ({ conversationId, receiverId }) => {
      const roomId = conversationId || (receiverId && getConversationId(userId, receiverId));
      if (roomId) socket.join(roomId);
    });

    socket.on('leaveChat', ({ conversationId, receiverId }) => {
      const roomId = conversationId || (receiverId && getConversationId(userId, receiverId));
      if (roomId) socket.leave(roomId);
    });

    // 3. Typing indicators
    socket.on('typing', ({ receiverId, conversationId }) => {
      if (!receiverId) return;
      if (conversationId && conversationId === receiverId) {
        // Group chat
        socket.to(conversationId).emit('userTyping', { senderId: userId });
      } else {
        // 1-to-1: emit strictly to receiver's user channel to prevent double events
        socket.to(`user:${receiverId}`).emit('userTyping', { senderId: userId });
      }
    });

    socket.on('stopTyping', ({ receiverId, conversationId }) => {
      if (!receiverId) return;
      if (conversationId && conversationId === receiverId) {
        // Group chat
        socket.to(conversationId).emit('userStopTyping', { senderId: userId });
      } else {
        // 1-to-1: emit strictly to receiver's user channel
        socket.to(`user:${receiverId}`).emit('userStopTyping', { senderId: userId });
      }
    });

    // 4. Real-time Messaging (Consolidated single-channel emits)
    socket.on(
      'sendMessage',
      async (
        {
          receiverId,
          message,
          conversationId,
          messageType = 'text',
          mediaUrl = '',
          mediaDuration = 0,
          isGroup = false,
        },
        callback
      ) => {
        try {
          if (!receiverId || (!message && !mediaUrl)) {
            if (callback) callback({ success: false, error: 'Receiver ID and content are required' });
            return;
          }

          const roomId = conversationId || (isGroup ? receiverId : getConversationId(userId, receiverId));
          const receiverOnline = isGroup ? false : await isUserOnline(receiverId);

          const created = await Message.create({
            sender: userId,
            ...(isGroup ? { isGroup: true, groupId: receiverId } : { receiver: receiverId }),
            conversationId: roomId,
            message: (message || (messageType === 'audio' ? '🎤 Voice message' : '')).trim(),
            messageType: messageType || 'text',
            mediaUrl: mediaUrl || '',
            mediaDuration: Number(mediaDuration) || 0,
            status: receiverOnline ? 'delivered' : 'sent',
            timestamp: new Date(),
          });

          // Fetch populated message with lean projection
          const newMessage = await Message.findById(created._id)
            .select(
              '_id conversationId sender receiver isGroup groupId message messageType mediaUrl mediaDuration status starredBy deletedFor isDeleted deletedAt createdAt timestamp'
            )
            .populate('sender', 'name profilePic')
            .populate('receiver', 'name profilePic')
            .lean();

          if (isGroup) {
            // Group chat: Emit to room once
            socket.join(roomId);
            socket.to(roomId).emit('newMessage', newMessage);
          } else {
            // 1-to-1 chat: Unhide chats if deleted previously
            User.updateMany(
              { _id: { $in: [userId, receiverId] } },
              { $pull: { deletedChats: { $in: [userId, receiverId] } } }
            ).catch(() => {});

            // CONSOLIDATED TARGET: Emit strictly to receiver's personal user channel once
            // (Prevents double renders if receiver also joined roomId)
            socket.to(`user:${receiverId}`).emit('newMessage', newMessage);
          }

          if (callback) callback({ success: true, data: newMessage });
        } catch (error) {
          console.error('Error in sendMessage:', error.message);
          if (callback) callback({ success: false, error: 'Server error while sending message' });
        }
      }
    );

    // 5. Mark messages as read
    socket.on('markRead', async ({ senderId, conversationId }) => {
      try {
        if (!senderId) return;

        await Message.updateMany(
          { sender: senderId, receiver: userId, status: { $ne: 'read' } },
          { status: 'read' }
        );

        // Notify the original sender that their messages were read
        socket.to(`user:${senderId}`).emit('messagesRead', { readerId: userId });
      } catch (error) {
        console.error('Error in markRead:', error.message);
      }
    });

    // 6. Delete message in real-time (Delete for Everyone - Consolidated emits)
    socket.on('deleteMessage', async ({ messageId, conversationId, receiverId }, callback) => {
      try {
        if (!messageId) {
          if (callback) callback({ success: false, error: 'Message ID is required' });
          return;
        }

        const msg = await Message.findById(messageId);
        if (!msg) {
          if (callback) callback({ success: false, error: 'Message not found' });
          return;
        }

        const senderId = (msg.sender?._id || msg.sender || msg.senderId)?.toString();
        if (senderId !== userId) {
          if (callback) callback({ success: false, error: 'Only the sender can delete this message for everyone' });
          return;
        }

        msg.isDeleted = true;
        msg.message = 'This message was deleted';
        msg.mediaUrl = '';
        msg.mediaDuration = 0;
        msg.deletedAt = new Date();
        await msg.save();

        const roomId = conversationId || msg.conversationId;
        const targetReceiverId = receiverId || (msg.receiver?._id || msg.receiver || msg.receiverId)?.toString();

        const deletePayload = {
          messageId: msg._id.toString(),
          conversationId: roomId,
          isDeleted: true,
          message: 'This message was deleted',
          deletedAt: msg.deletedAt,
        };

        if (msg.isGroup) {
          // Group: emit to roomId once
          socket.to(roomId).emit('messageDeleted', deletePayload);
        } else if (targetReceiverId) {
          // 1-to-1: emit strictly to receiver's user channel once (no duplicate room emit)
          socket.to(`user:${targetReceiverId}`).emit('messageDeleted', deletePayload);
        }

        // Emit back to sender socket
        socket.emit('messageDeleted', deletePayload);

        if (callback) callback({ success: true, data: deletePayload });
      } catch (error) {
        console.error('Error in socket deleteMessage:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // 7. Ultra-fast Disconnect Handling via Redis In-Memory State
    socket.on('disconnect', async () => {
      const { isFullyOffline, lastSeen } = await removeUserSocket(userId, socket.id);
      if (!isFullyOffline) return;

      const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date();

      try {
        const remainingOnline = await getOnlineUserIds();
        io.emit('getOnlineUsers', remainingOnline);
        io.emit('userStatusChanged', { userId, status: 'offline', lastSeen: lastSeenDate });

        User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: lastSeenDate }).catch(() => {});
      } catch (err) {
        console.error('Error updating offline status:', err.message);
      }
    });
  });

  return io;
};
