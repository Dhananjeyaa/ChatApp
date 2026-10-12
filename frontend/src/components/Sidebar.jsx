import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Search,
  ArrowLeft,
  MoreVertical,
  Filter,
  CheckCheck,
  LogOut,
  User,
  Settings,
  Star,
  Users,
  X,
  Mic,
  Trash2,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';
import NewGroupModal from './NewGroupModal';
import StarredMessagesModal from './StarredMessagesModal';
import SettingsModal from './SettingsModal';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatTimestamp = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
    return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatLastSeen = (dateString) => {
  if (!dateString) return 'offline';
  const date = new Date(dateString);
  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return `last seen today at ${timeStr}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
    return `last seen yesterday at ${timeStr}`;
  return `last seen ${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} at ${timeStr}`;
};

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
const DeleteConfirmModal = ({ chatItem, onConfirm, onCancel, isDeleting }) => {
  useEffect(() => {
    if (!chatItem) return;
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatItem, onCancel]);

  if (!chatItem) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete chat confirmation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#111b21] rounded-t-2xl sm:rounded-2xl shadow-2xl px-6 pt-6 pb-8 sm:pb-6 z-10 animate-[slideUp_200ms_ease-out] border border-transparent dark:border-[#222e35]">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
            <Trash2 size={22} className="text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h2 className="text-center text-[15px] font-semibold text-[#111b21] dark:text-[#e9edef] mb-1">
          Delete this chat?
        </h2>
        <p className="text-center text-sm text-[#667781] dark:text-[#8696a0] mb-6 leading-snug">
          All messages with{' '}
          <span className="font-medium text-[#111b21] dark:text-white">{chatItem.name}</span> will be
          permanently deleted. This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-[#e9edef] dark:border-[#222e35] text-sm font-medium text-[#54656f] dark:text-[#8696a0] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700 active:scale-95 transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Per-Chat Context Menu ──────────────────────────────────────────────────────
const ChatContextMenu = ({ chatItem, position, onDelete, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!chatItem) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      className="fixed z-[1050] bg-white dark:bg-[#202c33] rounded-xl shadow-[0_6px_24px_0_rgba(11,20,26,0.18)] border border-[#e9edef] dark:border-[#222e35] py-1 min-w-[160px]"
    >
      <button
        type="button"
        onClick={() => {
          onClose();
          onDelete(chatItem);
        }}
        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-3 transition-colors cursor-pointer"
      >
        <Trash2 size={15} />
        <span>Delete chat</span>
      </button>
    </div>
  );
};

// ── Sidebar Component ──────────────────────────────────────────────────────────
const Sidebar = memo(() => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Top header modals
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [starredModalOpen, setStarredModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Per-chat context menu state
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mobile long-press touch positioning refs
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    selectedUser,
    setSelectedUser,
    onlineUsers = [],
    userLastSeenMap,
    deleteChat,
    conversations = [],
    setConversations,
  } = useChat();

  const { user, setUser, token, logout } = useAuth();
  const menuRef = useRef(null);

  // Close top 3-dot dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close context menu on scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [contextMenu]);

  // Initial fetch of conversations & groups into centralized ChatContext state
  useEffect(() => {
    let active = true;
    if (!token) {
      setLoadingUsers(false);
      return;
    }

    Promise.allSettled([
      axios.get(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_URL}/api/users/groups`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(([usersRes, groupsRes]) => {
        if (!active) return;
        const u = usersRes.status === 'fulfilled' ? usersRes.value.data || [] : [];
        const g = groupsRes.status === 'fulfilled' ? groupsRes.value.data || [] : [];
        const combined = [...g, ...u].sort((a, b) => {
          const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
          const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
          return timeB - timeA;
        });

        if (typeof setConversations === 'function') {
          setConversations(combined);
        }
      })
      .catch((err) => {
        console.error('fetchChats error:', err.message);
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, [token, setConversations]);

  // Dynamic search: fetch from backend when searching for contacts or new chats
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let active = true;
    setIsSearching(true);
    const timer = setTimeout(() => {
      axios
        .get(`${API_URL}/api/users?search=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(({ data }) => {
          if (!active) return;
          const matchingGroups = conversations.filter(
            (u) => u.isGroup && u.name?.toLowerCase().includes(trimmed.toLowerCase())
          );
          setSearchResults([...matchingGroups, ...(data || [])]);
        })
        .catch((err) => {
          console.error('Search users error:', err.message);
          if (active) setSearchResults([]);
        })
        .finally(() => {
          if (active) setIsSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, token, conversations]);

  const handleGroupCreated = (newGroup) => {
    setConversations((prev) => [newGroup, ...prev]);
    setSelectedUser(newGroup);
  };

  const handleSelectStarredChat = (chatPartner) => {
    if (!chatPartner?._id) return;
    const existing = conversations.find((u) => u._id === chatPartner._id);
    setSelectedUser(existing || chatPartner);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  // ── Per-chat 3-dot button click (desktop) ──
  const handleChatMenuClick = useCallback((e, chatItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 48;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = rect.left;
    let y = rect.bottom + 4;

    if (x + menuWidth > vw) x = vw - menuWidth - 8;
    if (y + menuHeight > vh) y = rect.top - menuHeight - 4;

    setContextMenu({ chatItem, x, y });
  }, []);

  // ── Long-press handlers (mobile touch) with movement cancel ──
  const handleTouchStart = useCallback((e, chatItem) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    longPressTimer.current = setTimeout(() => {
      const menuWidth = 160;
      const vw = window.innerWidth;
      let x = touch.clientX;
      if (x + menuWidth > vw) x = vw - menuWidth - 8;
      setContextMenu({ chatItem, x, y: touch.clientY });
      longPressTimer.current = null;
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    // If the finger moves more than 8px on either axis, it's a scroll gesture — cancel long press immediately
    if (longPressTimer.current && e.touches?.[0]) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      if (deltaX > 8 || deltaY > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // ── Confirm delete ──
  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteChat(confirmDelete._id);
    } catch (err) {
      console.error('deleteChat error:', err.message);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  }, [confirmDelete, isDeleting, deleteChat]);

  const activeList = searchTerm.trim() ? searchResults : conversations;
  const filteredUsers = activeList.filter((u) => {
    const matchSearch = searchTerm.trim()
      ? true
      : u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUnread = unreadOnly ? (u.unreadCount > 0) : true;
    return matchSearch && matchUnread;
  });

  return (
    <div className="w-full h-full bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#222e35] flex flex-col shrink-0 select-none z-20 transition-colors">
      {/* ── 1. Top Header Bar ── */}
      <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2.5 flex items-center justify-between border-b border-[#e9edef] dark:border-[#222e35] transition-colors">
        {/* User Avatar */}
        <div
          onClick={() => setProfileModalOpen(true)}
          className="relative cursor-pointer"
          title="Your profile"
        >
          <Avatar src={user?.profilePic} name={user?.name} size={40} online={false} />
        </div>

        {/* Three-Dot Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              menuOpen ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#54656f] dark:text-[#aebac1]'
            }`}
            title="Menu"
          >
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white dark:bg-[#233138] rounded-xl shadow-[0_6px_24px_0_rgba(11,20,26,0.18)] py-2 border border-[#e9edef] dark:border-[#222e35] z-50 animate-in fade-in zoom-in-95 duration-100">
              {[
                {
                  icon: <User size={16} />,
                  label: 'Profile',
                  action: () => {
                    setMenuOpen(false);
                    setProfileModalOpen(true);
                  },
                },
                {
                  icon: <Users size={16} />,
                  label: 'New group',
                  action: () => {
                    setMenuOpen(false);
                    setNewGroupModalOpen(true);
                  },
                },
                {
                  icon: <Star size={16} />,
                  label: 'Starred messages',
                  action: () => {
                    setMenuOpen(false);
                    setStarredModalOpen(true);
                  },
                },
                {
                  icon: <Settings size={16} />,
                  label: 'Settings',
                  action: () => {
                    setMenuOpen(false);
                    setSettingsModalOpen(true);
                  },
                },
              ].map(({ icon, label, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#111b21] dark:text-[#d1d7db] hover:bg-[#f5f6f6] dark:hover:bg-[#182229] flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <span className="text-[#54656f] dark:text-[#8696a0]">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}

              <div className="h-[1px] bg-[#e9edef] dark:bg-[#222e35] my-1" />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Search Bar ── */}
      <div className="px-3 py-2 bg-white dark:bg-[#111b21] border-b border-[#e9edef] dark:border-[#222e35] flex items-center gap-2 transition-colors">
        <div className="flex-1 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl flex items-center px-3 py-1.5 focus-within:bg-white dark:focus-within:bg-[#111b21] focus-within:shadow-[0_0_0_1px_#00a884] transition-all">
          {isSearchFocused || searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setIsSearchFocused(false);
              }}
              className="text-[#00a884] mr-3 hover:scale-110 transition-transform cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Search size={18} className="text-[#54656f] dark:text-[#8696a0] mr-3 shrink-0" />
          )}
          <input
            type="text"
            value={searchTerm}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              if (!searchTerm) setIsSearchFocused(false);
            }}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full bg-transparent text-sm text-[#111b21] dark:text-[#e9edef] placeholder-[#8696a0] focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[#8696a0] hover:text-[#111b21] dark:hover:text-white ml-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setUnreadOnly((p) => !p)}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            unreadOnly ? 'bg-[#00a884] text-white' : 'text-[#54656f] dark:text-[#8696a0] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          title="Filter unread"
        >
          <Filter size={18} />
        </button>
      </div>

      {/* ── 3. Chat List ── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[#f0f2f5] dark:divide-[#222e35]"
        style={{ touchAction: 'pan-y' }}
      >
        {loadingUsers || isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#8696a0] text-sm gap-2">
            <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            <span>{isSearching ? 'Searching...' : 'Loading chats...'}</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-6 text-[#8696a0] text-sm">
            {searchTerm ? 'No results for your search.' : 'No chats yet.'}
          </div>
        ) : (
          filteredUsers.map((chatItem) => {
            const isSelected = selectedUser?._id === chatItem._id;
            const isOnline =
              !chatItem.isGroup &&
              onlineUsers.includes(chatItem._id) &&
              chatItem._id !== user?._id;
            const lastSeenTime = userLastSeenMap[chatItem._id] || chatItem.lastSeen;
            const lastMsg = chatItem.lastMessage;
            const isSentByMe = lastMsg?.sender === user?._id;
            const isHovered = hoveredChatId === chatItem._id;

            return (
              <div
                key={chatItem._id}
                className={`flex items-center gap-3.5 px-4 py-3 cursor-pointer transition-all duration-150 relative select-none ${
                  isSelected
                    ? 'bg-[#f0f2f5] dark:bg-[#2a3942] border-l-[4px] border-l-[#00a884] pl-3'
                    : 'hover:bg-[#f8f9fa] dark:hover:bg-[#202c33] active:bg-[#f0f2f5] dark:active:bg-[#2a3942]'
                }`}
                onClick={() => setSelectedUser(chatItem)}
                onMouseEnter={() => setHoveredChatId(chatItem._id)}
                onMouseLeave={() => setHoveredChatId(null)}
                onTouchStart={(e) => handleTouchStart(e, chatItem)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onTouchCancel={handleTouchEnd}
              >
                {chatItem.isGroup ? (
                  <div className="w-12 h-12 rounded-full bg-[#00a884]/15 flex items-center justify-center text-[#00a884] shrink-0 font-bold">
                    <Users size={24} />
                  </div>
                ) : (
                  <Avatar
                    src={chatItem.profilePic}
                    name={chatItem.name}
                    size={48}
                    online={isOnline}
                  />
                )}

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-sm font-medium text-[#111b21] dark:text-[#e9edef] truncate flex items-center gap-1.5">
                      <span>{chatItem.name}</span>
                      {chatItem.isGroup && (
                        <span className="text-[10px] text-[#00a884] bg-[#e7f7f3] dark:bg-[#00a884]/20 px-1.5 py-0.2 rounded font-normal">
                          Group
                        </span>
                      )}
                    </h3>
                    <span
                      className={`text-[11px] shrink-0 ${
                        chatItem.unreadCount > 0 ? 'text-[#00a884] font-semibold' : 'text-[#667781] dark:text-[#8696a0]'
                      }`}
                    >
                      {formatTimestamp(lastMsg?.timestamp || chatItem.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0 text-xs text-[#667781] dark:text-[#8696a0]">
                      {isSentByMe && lastMsg && (
                        <CheckCheck
                          size={15}
                          className={`shrink-0 ${
                            lastMsg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'
                          }`}
                        />
                      )}
                      {lastMsg ? (
                        <p className="truncate text-[#667781] dark:text-[#8696a0] text-xs flex items-center gap-1">
                          {lastMsg.messageType === 'audio' && (
                            <Mic size={13} className="text-[#00a884] shrink-0" />
                          )}
                          <span className={lastMsg.isDeleted ? 'italic' : ''}>{lastMsg.message}</span>
                        </p>
                      ) : (
                        <p className="truncate italic text-[11px] text-[#8696a0]">
                          {chatItem.isGroup
                            ? `${chatItem.members?.length || 0} participants`
                            : isOnline
                            ? 'online'
                            : formatLastSeen(lastSeenTime)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {chatItem.unreadCount > 0 && !isHovered && (
                        <span className="bg-[#00a884] text-white text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center">
                          {chatItem.unreadCount}
                        </span>
                      )}

                      {/* 3-dot button — visible on hover (desktop) */}
                      {isHovered && (
                        <button
                          type="button"
                          aria-label="Chat options"
                          onClick={(e) => handleChatMenuClick(e, chatItem)}
                          className="p-1 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 4. Modals ── */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onUpdateUser={(updated) => setUser(updated)}
        onLogout={handleLogout}
      />

      <NewGroupModal
        isOpen={newGroupModalOpen}
        onClose={() => setNewGroupModalOpen(false)}
        contacts={conversations}
        onlineUsers={onlineUsers}
        onGroupCreated={handleGroupCreated}
      />

      <StarredMessagesModal
        isOpen={starredModalOpen}
        onClose={() => setStarredModalOpen(false)}
        onSelectChat={handleSelectStarredChat}
        token={token}
        currentUser={user}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      {/* ── 5. Per-Chat Context Menu ── */}
      {contextMenu && (
        <ChatContextMenu
          chatItem={contextMenu.chatItem}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onDelete={(item) => setConfirmDelete(item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── 6. Delete Confirmation Modal ── */}
      {confirmDelete && (
        <DeleteConfirmModal
          chatItem={confirmDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;