import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { getConversationId } from '../utils/chatUtils';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { token, user } = useAuth();
  const userId = user?._id;
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUserState] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userLastSeenMap, setUserLastSeenMap] = useState({});

  // Message cache per conversation ID to prevent "No messages yet" drops
  const messageCacheRef = useRef({});
  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Helper to compute conversation ID
  const getConvId = useCallback(
    (target) => {
      if (!target) return '';
      if (target.isGroup) return target._id;
      return userId ? getConversationId(userId, target._id) : target._id;
    },
    [userId]
  );

  // Stable setSelectedUser that preserves cached messages and avoids wiping on re-selection
  const setSelectedUser = useCallback(
    (userOrGroup) => {
      if (!userOrGroup) {
        setSelectedUserState(null);
        setMessages([]);
        setNextCursor(null);
        setHasMoreMessages(false);
        return;
      }

      const prevActive = selectedUserRef.current;
      const targetId = userOrGroup._id;

      // Re-selecting the exact same active conversation (e.g. from modal or sidebar re-click)
      if (prevActive && prevActive._id === targetId) {
        // Update userOrGroup metadata (in case status or pic changed) without dropping messages
        setSelectedUserState(userOrGroup);
        return;
      }

      // Switching to a different chat: check if cached messages exist
      const convId = userOrGroup.isGroup
        ? targetId
        : userId
        ? getConversationId(userId, targetId)
        : targetId;

      const cached = messageCacheRef.current[convId];
      if (cached && cached.length > 0) {
        setMessages(cached);
        setLoadingMessages(false);
      } else {
        setMessages([]);
        setLoadingMessages(true);
      }

      setNextCursor(null);
      setHasMoreMessages(false);
      setSelectedUserState(userOrGroup);

      // Clear unread count for this conversation in conversations state
      setConversations((prev) =>
        prev.map((c) => (c._id === targetId ? { ...c, unreadCount: 0 } : c))
      );
    },
    [userId]
  );

  // 1. Socket connection lifecycle & real-time synchronization
  useEffect(() => {
    if (!token || !userId) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const handleOnlineUsers = (userIds) => setOnlineUsers(userIds || []);

    const handleStatusChanged = ({ userId: uId, status, lastSeen }) => {
      setOnlineUsers((prev) =>
        status === 'online'
          ? prev.includes(uId) ? prev : [...prev, uId]
          : prev.filter((id) => id !== uId)
      );
      if (lastSeen) setUserLastSeenMap((prev) => ({ ...prev, [uId]: lastSeen }));
    };

    const handleNewMessage = (newMsg) => {
      if (!newMsg || !newMsg._id) return;
      const activeUser = selectedUserRef.current;
      const senderId = (newMsg.sender?._id || newMsg.sender)?.toString();
      const receiverId = (newMsg.receiver?._id || newMsg.receiver)?.toString();
      const myIdStr = userId?.toString();

      // Determine conversation key
      const isGroupMsg = Boolean(newMsg.isGroup || newMsg.groupId);
      const convId = isGroupMsg
        ? (newMsg.groupId || newMsg.conversationId)
        : senderId === myIdStr
        ? getConversationId(myIdStr, receiverId)
        : getConversationId(myIdStr, senderId);

      // Check if this message belongs to currently open chat
      const isForCurrentChat =
        activeUser &&
        (activeUser.isGroup
          ? activeUser._id === (newMsg.groupId || newMsg.conversationId)
          : activeUser._id?.toString() === senderId || activeUser._id?.toString() === receiverId);

      // 1. Update active messages if relevant
      if (isForCurrentChat) {
        setMessages((prev) => (prev.some((m) => m._id === newMsg._id) ? prev : [...prev, newMsg]));
      }

      // 2. Always update message cache for this conversation
      const existingCached = messageCacheRef.current[convId] || [];
      if (!existingCached.some((m) => m._id === newMsg._id)) {
        messageCacheRef.current[convId] = [...existingCached, newMsg];
      }

      // 3. Mark read if chat is currently active and sender is not me
      if (isForCurrentChat && senderId !== myIdStr) {
        newSocket.emit('markRead', {
          senderId,
          conversationId: convId,
        });
      }

      // 4. Real-time update sidebar conversation preview & unread counts
      setConversations((prev) => {
        const partnerId = isGroupMsg ? convId : senderId === myIdStr ? receiverId : senderId;
        const exists = prev.some((c) => c._id?.toString() === partnerId?.toString());

        const updatedLastMsg = {
          _id: newMsg._id,
          message: newMsg.message,
          messageType: newMsg.messageType || 'text',
          sender: senderId,
          receiver: receiverId,
          status: newMsg.status,
          timestamp: newMsg.createdAt || newMsg.timestamp || new Date().toISOString(),
        };

        if (exists) {
          const updated = prev.map((c) => {
            if (c._id?.toString() !== partnerId?.toString()) return c;
            const isCurrentlyOpen = activeUser && activeUser._id?.toString() === partnerId?.toString();
            return {
              ...c,
              lastMessage: updatedLastMsg,
              unreadCount: isCurrentlyOpen ? 0 : (c.unreadCount || 0) + (senderId !== myIdStr ? 1 : 0),
            };
          });

          // Move the conversation to the top
          return updated.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
            const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
            return timeB - timeA;
          });
        }

        // If conversation is brand new, build a lightweight preview entry
        const partnerName = newMsg.sender?.name || 'Contact';
        const partnerPic = newMsg.sender?.profilePic || '';
        const newConversation = {
          _id: partnerId,
          name: partnerName,
          profilePic: partnerPic,
          isGroup: isGroupMsg,
          lastMessage: updatedLastMsg,
          unreadCount: isForCurrentChat ? 0 : 1,
        };

        return [newConversation, ...prev];
      });
    };

    const handleMessagesRead = ({ readerId }) => {
      if (!readerId) return;
      const readerIdStr = readerId.toString();

      // Update in active messages
      setMessages((prev) =>
        prev.map((msg) => {
          const recId = (msg.receiver?._id || msg.receiver)?.toString();
          return recId === readerIdStr ? { ...msg, status: 'read' } : msg;
        })
      );

      // Update in message cache
      Object.keys(messageCacheRef.current).forEach((key) => {
        messageCacheRef.current[key] = (messageCacheRef.current[key] || []).map((msg) => {
          const recId = (msg.receiver?._id || msg.receiver)?.toString();
          return recId === readerIdStr ? { ...msg, status: 'read' } : msg;
        });
      });

      // Update in sidebar conversations
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id?.toString() === readerIdStr && c.lastMessage) {
            return {
              ...c,
              lastMessage: { ...c.lastMessage, status: 'read' },
            };
          }
          return c;
        })
      );
    };

    const handleUserTyping = ({ senderId }) => setTypingUser(senderId);
    const handleUserStopTyping = ({ senderId }) =>
      setTypingUser((cur) => (cur === senderId ? null : cur));

    const handleMessageDeleted = ({ messageId, isDeleted, message, deletedAt, conversationId }) => {
      if (!messageId) return;

      const deleteUpdate = (msg) => {
        if (msg._id === messageId) {
          return {
            ...msg,
            isDeleted: isDeleted ?? true,
            message: message || 'This message was deleted',
            mediaUrl: '',
            mediaDuration: 0,
            deletedAt: deletedAt || new Date().toISOString(),
          };
        }
        return msg;
      };

      // 1. Update in active messages
      setMessages((prev) => prev.map(deleteUpdate));

      // 2. Update in all message caches
      Object.keys(messageCacheRef.current).forEach((key) => {
        messageCacheRef.current[key] = (messageCacheRef.current[key] || []).map(deleteUpdate);
      });

      // 3. Update in sidebar conversation last message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.lastMessage?._id === messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                isDeleted: true,
                message: 'This message was deleted',
              },
            };
          }
          return c;
        })
      );
    };

    // Register event listeners
    newSocket.on('getOnlineUsers', handleOnlineUsers);
    newSocket.on('userStatusChanged', handleStatusChanged);
    newSocket.on('newMessage', handleNewMessage);
    newSocket.on('messagesRead', handleMessagesRead);
    newSocket.on('userTyping', handleUserTyping);
    newSocket.on('userStopTyping', handleUserStopTyping);
    newSocket.on('messageDeleted', handleMessageDeleted);

    setSocket(newSocket);

    return () => {
      newSocket.off('getOnlineUsers', handleOnlineUsers);
      newSocket.off('userStatusChanged', handleStatusChanged);
      newSocket.off('newMessage', handleNewMessage);
      newSocket.off('messagesRead', handleMessagesRead);
      newSocket.off('userTyping', handleUserTyping);
      newSocket.off('userStopTyping', handleUserStopTyping);
      newSocket.off('messageDeleted', handleMessageDeleted);
      newSocket.removeAllListeners();
      newSocket.disconnect();

      setSocket(null);
      setOnlineUsers([]);
    };
  }, [token, userId]);

  // 2. Chat room join/leave
  useEffect(() => {
    if (!socket || !selectedUser?._id || !userId) return;

    const conversationId = selectedUser.isGroup
      ? selectedUser._id
      : getConversationId(userId, selectedUser._id);

    socket.emit('joinChat', { conversationId });
    return () => {
      socket.emit('leaveChat', { conversationId });
    };
  }, [socket, selectedUser?._id, selectedUser?.isGroup, userId]);

  // 3. Fetch chat history (Cursor-compatible) with cache preservation
  useEffect(() => {
    let active = true;
    if (!selectedUser?._id || !token) return;

    const convId = selectedUser.isGroup
      ? selectedUser._id
      : userId
      ? getConversationId(userId, selectedUser._id)
      : selectedUser._id;

    // If cache is empty, display loading spinner; otherwise keep existing messages in view
    if (!messageCacheRef.current[convId] || messageCacheRef.current[convId].length === 0) {
      setLoadingMessages(true);
    }

    axios
      .get(`${API_URL}/api/messages/${selectedUser._id}?paginated=true&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (!active) return;
        let fetchedMsgs = [];
        let hasMore = false;
        let cursor = null;

        if (Array.isArray(data)) {
          fetchedMsgs = data;
          hasMore = false;
          cursor = null;
        } else {
          fetchedMsgs = data.messages || [];
          hasMore = Boolean(data.hasMore);
          cursor = data.nextCursor || null;
        }

        setMessages(fetchedMsgs);
        messageCacheRef.current[convId] = fetchedMsgs;
        setHasMoreMessages(hasMore);
        setNextCursor(cursor);

        if (socket && userId && !selectedUser.isGroup) {
          socket.emit('markRead', {
            senderId: selectedUser._id,
            conversationId: convId,
          });
        }
      })
      .catch((err) => {
        console.error('fetchMessages error:', err.message);
        // Only clear if no cached messages exist
        if (active && (!messageCacheRef.current[convId] || messageCacheRef.current[convId].length === 0)) {
          setMessages([]);
        }
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [selectedUser?._id, selectedUser?.isGroup, token, socket, userId]);

  // 4. Cursor-based fetch older messages
  const loadOlderMessages = useCallback(async () => {
    if (!selectedUser?._id || !token || loadingOlderMessages || !hasMoreMessages) return;

    const oldestMsg = messages[0];
    const cursor = nextCursor || oldestMsg?._id;
    if (!cursor) return;

    const convId = selectedUser.isGroup
      ? selectedUser._id
      : userId
      ? getConversationId(userId, selectedUser._id)
      : selectedUser._id;

    setLoadingOlderMessages(true);
    try {
      const { data } = await axios.get(
        `${API_URL}/api/messages/${selectedUser._id}?cursor=${cursor}&paginated=true&limit=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newMsgs = Array.isArray(data) ? data : data.messages || [];
      const hasMore = Array.isArray(data) ? false : Boolean(data.hasMore);
      const next = Array.isArray(data) ? null : data.nextCursor;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m._id));
        const uniqueOlder = newMsgs.filter((m) => !existingIds.has(m._id));
        const merged = [...uniqueOlder, ...prev];
        messageCacheRef.current[convId] = merged;
        return merged;
      });
      setHasMoreMessages(hasMore);
      setNextCursor(next);
    } catch (err) {
      console.error('loadOlderMessages error:', err.message);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedUser?._id, selectedUser?.isGroup, token, loadingOlderMessages, hasMoreMessages, messages, nextCursor, userId]);

  // 5. Typing status emitters
  const sendTypingStatus = useCallback(
    (receiverId) => {
      if (!socket || !receiverId || !userId) return;
      const conversationId = selectedUserRef.current?.isGroup
        ? receiverId
        : getConversationId(userId, receiverId);
      socket.emit('typing', { receiverId, conversationId });
    },
    [socket, userId]
  );

  const sendStopTypingStatus = useCallback(
    (receiverId) => {
      if (!socket || !receiverId || !userId) return;
      const conversationId = selectedUserRef.current?.isGroup
        ? receiverId
        : getConversationId(userId, receiverId);
      socket.emit('stopTyping', { receiverId, conversationId });
    },
    [socket, userId]
  );

  // 6. Send message
  const sendMessage = useCallback(
    (receiverId, messageText, options = {}) => {
      if (!socket || !receiverId || !userId) return;
      const {
        messageType = 'text',
        mediaUrl = '',
        mediaDuration = 0,
        isGroup = selectedUserRef.current?.isGroup || false,
      } = options;

      const conversationId = isGroup ? receiverId : getConversationId(userId, receiverId);

      socket.emit(
        'sendMessage',
        {
          receiverId,
          message: messageText || (messageType === 'audio' ? '🎤 Voice message' : ''),
          conversationId,
          messageType,
          mediaUrl,
          mediaDuration,
          isGroup,
        },
        (response) => {
          if (response?.success && response.data) {
            const newMsg = response.data;
            setMessages((prev) =>
              prev.some((m) => m._id === newMsg._id) ? prev : [...prev, newMsg]
            );

            // Update cache
            const cached = messageCacheRef.current[conversationId] || [];
            if (!cached.some((m) => m._id === newMsg._id)) {
              messageCacheRef.current[conversationId] = [...cached, newMsg];
            }

            // Update sidebar conversation preview immediately
            setConversations((prev) => {
              const updated = prev.map((c) => {
                if (c._id?.toString() !== receiverId?.toString()) return c;
                return {
                  ...c,
                  lastMessage: {
                    _id: newMsg._id,
                    message: newMsg.message,
                    messageType: newMsg.messageType || 'text',
                    sender: userId,
                    receiver: receiverId,
                    status: newMsg.status,
                    timestamp: newMsg.createdAt || new Date().toISOString(),
                  },
                };
              });

              return updated.sort((a, b) => {
                const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
                const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
                return timeB - timeA;
              });
            });
          }
        }
      );
    },
    [socket, userId]
  );

  // 7. Star/bookmark message
  const toggleStarMessage = useCallback(
    async (messageId) => {
      if (!token || !userId || !messageId) return;
      try {
        const { data } = await axios.put(
          `${API_URL}/api/messages/${messageId}/star`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          const userIdStr = userId.toString();
          const updateStar = (msg) => {
            if (msg._id !== messageId) return msg;
            const currentStarred = (msg.starredBy || []).map((id) =>
              typeof id === 'object' && id._id ? id._id.toString() : id.toString()
            );
            return {
              ...msg,
              starredBy: data.starred
                ? [...currentStarred, userIdStr]
                : currentStarred.filter((id) => id !== userIdStr),
            };
          };

          setMessages((prev) => prev.map(updateStar));
          Object.keys(messageCacheRef.current).forEach((key) => {
            messageCacheRef.current[key] = (messageCacheRef.current[key] || []).map(updateStar);
          });
        }
      } catch (err) {
        console.error('toggleStarMessage error:', err);
      }
    },
    [token, userId]
  );

  // 8. Delete message for Me
  const deleteMessageForMe = useCallback(
    async (messageId) => {
      if (!token || !messageId) return;
      try {
        const { data } = await axios.post(
          `${API_URL}/api/messages/${messageId}/delete-for-me`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          // Immediately hide message from current user's active state
          setMessages((prev) => prev.filter((m) => m._id !== messageId));

          // Remove from all caches
          Object.keys(messageCacheRef.current).forEach((key) => {
            messageCacheRef.current[key] = (messageCacheRef.current[key] || []).filter(
              (m) => m._id !== messageId
            );
          });
        }
        return data;
      } catch (err) {
        console.error('deleteMessageForMe error:', err.message);
        throw err;
      }
    },
    [token]
  );

  // 9. Delete message for Everyone
  const deleteMessageForEveryone = useCallback(
    async (messageId) => {
      if (!messageId) return;
      const activeUser = selectedUserRef.current;
      const conversationId = activeUser?.isGroup
        ? activeUser._id
        : userId && activeUser?._id
        ? getConversationId(userId, activeUser._id)
        : undefined;
      const receiverId = activeUser?.isGroup ? undefined : activeUser?._id;

      const optimisticDelete = {
        _id: messageId,
        isDeleted: true,
        message: 'This message was deleted',
        mediaUrl: '',
        mediaDuration: 0,
        deletedAt: new Date().toISOString(),
      };

      const applyDelete = (msg) => (msg._id === messageId ? { ...msg, ...optimisticDelete } : msg);

      // Real-time via socket if connected
      if (socket && socket.connected) {
        return new Promise((resolve, reject) => {
          socket.emit(
            'deleteMessage',
            { messageId, conversationId, receiverId },
            (response) => {
              if (response?.success) {
                setMessages((prev) => prev.map(applyDelete));
                if (conversationId && messageCacheRef.current[conversationId]) {
                  messageCacheRef.current[conversationId] =
                    messageCacheRef.current[conversationId].map(applyDelete);
                }
                resolve(response.data);
              } else {
                reject(new Error(response?.error || 'Failed to delete message'));
              }
            }
          );
        });
      }

      // REST fallback
      try {
        const { data } = await axios.post(
          `${API_URL}/api/messages/${messageId}/delete-for-everyone`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setMessages((prev) => prev.map(applyDelete));
          if (conversationId && messageCacheRef.current[conversationId]) {
            messageCacheRef.current[conversationId] =
              messageCacheRef.current[conversationId].map(applyDelete);
          }
        }
        return data;
      } catch (err) {
        console.error('deleteMessageForEveryone error:', err.message);
        throw err;
      }
    },
    [socket, token, userId]
  );

  // 10. Delete all messages in a conversation
  const deleteChat = useCallback(
    async (targetUserId) => {
      if (!token || !targetUserId) return;
      const res = await axios.delete(`${API_URL}/api/messages/chat/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Clear cache for this conversation
      const convId = userId ? getConversationId(userId, targetUserId) : targetUserId;
      delete messageCacheRef.current[convId];
      delete messageCacheRef.current[targetUserId];

      // Remove that user instantly from conversations state
      setConversations((prev) => prev.filter((c) => c._id !== targetUserId));

      // Reset selectedUser and clear messages if this chat is currently open
      if (selectedUserRef.current?._id === targetUserId) {
        setMessages([]);
        setSelectedUserState(null);
      }
      return res.data;
    },
    [token, userId]
  );

  return (
    <ChatContext.Provider
      value={{
        socket,
        messages,
        setMessages,
        selectedUser,
        setSelectedUser,
        sendMessage,
        toggleStarMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        deleteChat,
        conversations,
        setConversations,
        users: conversations,
        setUsers: setConversations,
        loadingMessages,
        loadingOlderMessages,
        hasMoreMessages,
        loadOlderMessages,
        typingUser,
        onlineUsers,
        userLastSeenMap,
        sendTypingStatus,
        sendStopTypingStatus,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
