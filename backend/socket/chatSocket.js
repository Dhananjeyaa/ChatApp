import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { getConversationId } from '../utils/chatUtils.js';

export const initSocket = (server) => {
  const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10MB limit for voice note data transmission
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const userSocketMap = new Map();

  const addUserSocket = (userId, socketId) => {
    if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
    userSocketMap.get(userId).add(socketId);
  };

  const removeUserSocket = (userId, socketId) => {
    const set = userSocketMap.get(userId);
    if (!set) return true;
    set.delete(socketId);
    if (set.size === 0) {
      userSocketMap.delete(userId);
      return true;
    }
    return false;
  };

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
      if (!token) return next(new Error('Authentication error: No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded._id;
      if (!userId) return next(new Error('Authentication error: Invalid token'));

      const user = await User.findById(userId).select('-password');
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

    addUserSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    try {
      await User.findByIdAndUpdate(userId, { status: 'online' });
      io.emit('getOnlineUsers', Array.from(userSocketMap.keys()));
      io.emit('userStatusChanged', { userId, status: 'online' });
    } catch (err) {
      console.error('Error updating online status:', err.message);
    }

    // Join/leave chat room
    socket.on('joinChat', ({ conversationId, receiverId }) => {
      const roomId = conversationId || (receiverId && getConversationId(userId, receiverId));
      if (roomId) socket.join(roomId);
    });

    socket.on('leaveChat', ({ conversationId, receiverId }) => {
      const roomId = conversationId || (receiverId && getConversationId(userId, receiverId));
      if (roomId) socket.leave(roomId);
    });

    // Typing indicators
    socket.on('typing', ({ receiverId, conversationId }) => {
      if (!receiverId) return;
      const roomId = conversationId || getConversationId(userId, receiverId);
      socket.to(roomId).emit('userTyping', { senderId: userId });
    });

    socket.on('stopTyping', ({ receiverId, conversationId }) => {
      if (!receiverId) return;
      const roomId = conversationId || getConversationId(userId, receiverId);
      socket.to(roomId).emit('userStopTyping', { senderId: userId });
    });

    // Messaging
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
          const isReceiverOnline = isGroup ? false : userSocketMap.has(receiverId);

          const created = await Message.create({
            sender: userId,
            ...(isGroup ? { isGroup: true, groupId: receiverId } : { receiver: receiverId }),
            conversationId: roomId,
            message: (message || (messageType === 'audio' ? '🎤 Voice message' : '')).trim(),
            messageType: messageType || 'text',
            mediaUrl: mediaUrl || '',
            mediaDuration: Number(mediaDuration) || 0,
            status: isReceiverOnline ? 'delivered' : 'sent',
            timestamp: new Date(),
          });

          const newMessage = await Message.findById(created._id)
            .populate('sender', 'name profilePic')
            .populate('receiver', 'name profilePic');

          if (!isGroup && receiverId) {
            await Promise.all([
              User.findByIdAndUpdate(userId, { $pull: { deletedChats: receiverId } }),
              User.findByIdAndUpdate(receiverId, { $pull: { deletedChats: userId } }),
            ]);
            socket.to(`user:${receiverId}`).emit('newMessage', newMessage);
          }

          socket.join(roomId);
          socket.to(roomId).emit('newMessage', newMessage);

          if (callback) callback({ success: true, data: newMessage });
        } catch (error) {
          console.error('Error in sendMessage:', error.message);
          if (callback) callback({ success: false, error: 'Server error while sending message' });
        }
      }
    );

    // Mark messages as read
    socket.on('markRead', async ({ senderId, conversationId }) => {
      try {
        if (!senderId) return;
        const roomId = conversationId || getConversationId(userId, senderId);

        await Message.updateMany(
          { sender: senderId, receiver: userId, status: { $ne: 'read' } },
          { status: 'read' }
        );

        io.to(roomId).emit('messagesRead', { readerId: userId });
      } catch (error) {
        console.error('Error in markRead:', error.message);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const isFullyOffline = removeUserSocket(userId, socket.id);
      if (!isFullyOffline) return;

      const lastSeenDate = new Date();
      try {
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: lastSeenDate });
        io.emit('getOnlineUsers', Array.from(userSocketMap.keys()));
        io.emit('userStatusChanged', { userId, status: 'offline', lastSeen: lastSeenDate });
      } catch (err) {
        console.error('Error updating offline status:', err.message);
      }
    });
  });

  return io;
};
