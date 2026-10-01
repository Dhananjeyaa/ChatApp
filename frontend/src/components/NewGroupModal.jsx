import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Search, Check, AlertCircle } from 'lucide-react';
import Avatar from './Avatar';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const NewGroupModal = ({ isOpen, onClose, contacts = [], onlineUsers = [], onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredContacts = contacts.filter((c) => {
    if (c.isGroup) return false;
    const matchName = c.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPhone = c.phone?.includes(searchTerm);
    const matchEmail = c.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchName || matchPhone || matchEmail;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('Please enter a group name.');
      return;
    }
    if (selectedIds.length === 0) {
      setErrorMsg('Please select at least 1 contact.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_URL}/api/users/groups`,
        {
          name: groupName.trim(),
          members: selectedIds,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success && data.group) {
        if (onGroupCreated) onGroupCreated(data.group);
        onClose();
      }
    } catch (err) {
      console.error('Create group error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity"
      style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl relative border border-[#e9edef] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto animate-in fade-in zoom-in-95 duration-150 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5 font-medium text-lg">
            <Users size={20} />
            <h3>New Group</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded-full transition-colors text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 shrink-0">
            {/* Group Name Input */}
            <div>
              <label className="text-xs text-[#667781] font-semibold block mb-1">
                Group Subject
              </label>
              <div className="flex items-center gap-2 border-b-2 border-[#00a884] pb-1.5">
                <input
                  type="text"
                  value={groupName}
                  maxLength={50}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Type group subject here..."
                  autoFocus
                  className="w-full text-base font-medium text-[#111b21] placeholder-[#8696a0] focus:outline-none bg-transparent"
                />
                <span className="text-xs text-[#8696a0] shrink-0">{groupName.length}/50</span>
              </div>
            </div>

            {/* Selected Chips */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {selectedIds.map((id) => {
                  const contact = contacts.find((c) => c._id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 bg-[#e7f7f3] text-[#00a884] text-xs font-medium px-2.5 py-1 rounded-full border border-[#00a884]/20"
                    >
                      <span className="truncate max-w-[120px]">{contact?.name || 'Contact'}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelect(id)}
                        className="hover:text-red-500 rounded-full cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search contacts */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-[#8696a0]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts to add..."
                className="w-full bg-[#f0f2f5] text-xs text-[#111b21] pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] transition-all"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 text-xs bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto px-4 divide-y divide-[#f0f2f5] border-t border-[#f0f2f5]">
            <p className="text-[11px] text-[#8696a0] font-semibold py-2 px-2 uppercase tracking-wider sticky top-0 bg-white">
              Contacts ({selectedIds.length} selected)
            </p>

            {filteredContacts.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#8696a0]">No contacts found.</p>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedIds.includes(contact._id);
                const isOnline = onlineUsers.includes(contact._id);

                return (
                  <div
                    key={contact._id}
                    onClick={() => toggleSelect(contact._id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#e7f7f3]/60' : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={contact.profilePic}
                        name={contact.name}
                        size={40}
                        online={isOnline}
                      />
                      <div>
                        <h4 className="text-sm font-medium text-[#111b21]">{contact.name}</h4>
                        <p className="text-xs text-[#8696a0] truncate max-w-[220px]">
                          {contact.about || contact.phone || contact.email}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#00a884] border-[#00a884] text-white'
                          : 'border-[#8696a0]/50'
                      }`}
                    >
                      {isSelected && <Check size={14} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Submit Footer */}
          <div className="p-4 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#54656f] hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !groupName.trim() || selectedIds.length === 0}
              className="px-5 py-2 bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? 'Creating...' : `Create Group (${selectedIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default NewGroupModal;
