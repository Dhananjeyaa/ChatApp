import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, ArrowRight, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const StarredMessagesModal = ({
  isOpen,
  onClose,
  onSelectChat,
  token,
  currentUser,
}) => {
  const [starredMessages, setStarredMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!isOpen || !token) return;

    setLoading(true);
    axios
      .get(`${API_URL}/api/messages/starred`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (active) setStarredMessages(data || []);
      })
      .catch((err) => {
        console.error('fetchStarred error:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, token]);

  const handleUnstar = async (msgId, e) => {
    e.stopPropagation();
    try {
      await axios.put(
        `${API_URL}/api/messages/${msgId}/star`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStarredMessages((prev) => prev.filter((m) => m._id !== msgId));
    } catch (err) {
      console.error('handleUnstar error:', err);
    }
  };

  const handleNavigate = (msg) => {
    const partner =
      msg.sender?._id === currentUser?._id ? msg.receiver : msg.sender;

    if (partner && onSelectChat) {
      onSelectChat(partner, msg._id);
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity"
      style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl relative border border-[#e9edef] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto animate-in fade-in zoom-in-95 duration-150 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5 font-medium text-lg">
            <Star size={20} className="fill-white" />
            <h3>Starred Messages</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded-full transition-colors text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8696a0] gap-3">
              <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading starred messages...</span>
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#8696a0] gap-3">
              <div className="w-16 h-16 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[#8696a0]">
                <Star size={32} />
              </div>
              <h4 className="text-base font-medium text-[#41525d]">No starred messages</h4>
              <p className="text-xs text-[#8696a0] max-w-xs leading-relaxed">
                Bookmark important messages in any chat using the star action.
              </p>
            </div>
          ) : (
            starredMessages.map((msg) => {
              const isMine = msg.sender?._id === currentUser?._id;
              const senderName = isMine ? 'You' : msg.sender?.name || 'Contact';
              const partner = isMine ? msg.receiver : msg.sender;

              return (
                <div
                  key={msg._id}
                  onClick={() => handleNavigate(msg)}
                  className="bg-[#f0f2f5] hover:bg-[#e7f7f3]/50 border border-[#e9edef] hover:border-[#00a884]/40 rounded-xl p-3.5 cursor-pointer transition-all group relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={partner?.profilePic}
                        name={partner?.name}
                        size={28}
                      />
                      <span className="text-xs font-semibold text-[#111b21]">
                        {senderName}{' '}
                        <span className="text-[#8696a0] font-normal">
                          {isMine && partner ? `to ${partner.name}` : ''}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#8696a0]">
                        {new Date(msg.createdAt || msg.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleUnstar(msg._id, e)}
                        title="Unstar message"
                        className="text-[#8696a0] hover:text-red-500 p-1 rounded-full transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#111b21] pl-9 pr-6 leading-relaxed line-clamp-3">
                    {msg.message}
                  </p>

                  <div className="flex items-center justify-end gap-1 text-[11px] text-[#00a884] font-medium mt-2 group-hover:translate-x-0.5 transition-transform">
                    <span>Jump to chat</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StarredMessagesModal;
