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
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userLastSeenMap, setUserLastSeenMap] = useState({});

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const setSelectedUser = useCallback((userOrGroup) => {
    setMessages([]);
    setSelectedUserState(userOrGroup);
  }, []);

  // 1. Socket connection lifecycle
  useEffect(() => {
    if (!token || !userId) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Register event listeners
    newSocket.on('getOnlineUsers', (userIds) => setOnlineUsers(userIds || []));
    newSocket.on('userStatusChanged', ({ userId: uId, status, lastSeen }) => {
      setOnlineUsers((prev) =>
        status === 'online'
          ? prev.includes(uId) ? prev : [...prev, uId]
          : prev.filter((id) => id !== uId)
      );
      if (lastSeen) setUserLastSeenMap((prev) => ({ ...prev, [uId]: lastSeen }));
    });

    newSocket.on('newMessage', (newMsg) => {
      const activeUser = selectedUserRef.current;
      const senderId = newMsg.sender?._id || newMsg.sender;
      const receiverId = newMsg.receiver?._id || newMsg.receiver;
      const isForCurrentChat =
        activeUser &&
        (activeUser.isGroup
          ? newMsg.groupId === activeUser._id || newMsg.conversationId === activeUser._id
          : activeUser._id === senderId || activeUser._id === receiverId);

      if (isForCurrentChat) {
        setMessages((prev) => (prev.some((m) => m._id === newMsg._id) ? prev : [...prev, newMsg]));
      }

      if (activeUser?._id === senderId && userId) {
        newSocket.emit('markRead', {
          senderId,
          conversationId: getConversationId(userId, senderId),
        });
      }
    });

    newSocket.on('messagesRead', ({ readerId }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          const receiverId = msg.receiver?._id || msg.receiver;
          return receiverId === readerId ? { ...msg, status: 'read' } : msg;
        })
      );
    });

    newSocket.on('userTyping', ({ senderId }) => setTypingUser(senderId));
    newSocket.on('userStopTyping', ({ senderId }) =>
      setTypingUser((cur) => (cur === senderId ? null : cur))
    );

    setSocket(newSocket);

    return () => {
      newSocket.off('getOnlineUsers');
      newSocket.off('userStatusChanged');
      newSocket.off('newMessage');
      newSocket.off('messagesRead');
      newSocket.off('userTyping');
      newSocket.off('userStopTyping');
      newSocket.disconnect();
      setSocket(null);
      setOnlineUsers([]);
      setMessages([]);
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

  // 3. Fetch chat history
  useEffect(() => {
    let active = true;
    if (!selectedUser?._id || !token) return;

    setLoadingMessages(true);
    axios
      .get(`${API_URL}/api/messages/${selectedUser._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (!active) return;
        setMessages(data || []);
        if (socket && userId && !selectedUser.isGroup) {
          socket.emit('markRead', {
            senderId: selectedUser._id,
            conversationId: getConversationId(userId, selectedUser._id),
          });
        }
      })
      .catch((err) => {
        console.error('fetchMessages error:', err.message);
        if (active) setMessages([]);
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [selectedUser?._id, selectedUser?.isGroup, token, socket, userId]);

  // 4. Typing status emitters
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

  // 5. Send message
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
            setMessages((prev) =>
              prev.some((m) => m._id === response.data._id) ? prev : [...prev, response.data]
            );
          }
        }
      );
    },
    [socket, userId]
  );

  // 6. Star/bookmark message
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
          setMessages((prev) =>
            prev.map((msg) => {
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
            })
          );
        }
      } catch (err) {
        console.error('toggleStarMessage error:', err);
      }
    },
    [token, userId]
  );

  // 7. Delete all messages in a conversation
  const deleteChat = useCallback(
    async (targetUserId) => {
      if (!token || !targetUserId) return;
      const res = await axios.delete(`${API_URL}/api/messages/chat/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove that user instantly from conversations state
      setConversations((prev) => prev.filter((c) => c._id !== targetUserId));
      // Reset selectedUser and clear messages if this chat is currently open
      if (selectedUserRef.current?._id === targetUserId) {
        setMessages([]);
        setSelectedUserState(null);
      }
      return res.data;
    },
    [token]
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
        deleteChat,
        conversations,
        setConversations,
        users: conversations,
        setUsers: setConversations,
        loadingMessages,
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
