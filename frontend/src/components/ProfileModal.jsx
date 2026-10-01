import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Check, Edit2, LogOut, Phone, Mail, User } from 'lucide-react';
import Avatar from './Avatar';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ProfileModal = ({ isOpen, onClose, user, onUpdateUser, onLogout }) => {
  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || 'Hey there! I am using WhatsApp.');
  const [profilePic, setProfilePic] = useState(user?.profilePic || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAbout(user.about || 'Hey there! I am using WhatsApp.');
      setProfilePic(user.profilePic || '');
    }
  }, [user]);

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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result);
      saveProfile({ profilePic: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (overrides = {}) => {
    setSaving(true);
    setStatusMsg('');
    try {
      const payload = {
        name: overrides.name !== undefined ? overrides.name : name,
        about: overrides.about !== undefined ? overrides.about : about,
        profilePic: overrides.profilePic !== undefined ? overrides.profilePic : profilePic,
      };

      const token = localStorage.getItem('token');
      const { data } = await axios.put(`${API_URL}/api/users/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success && data.user) {
        if (onUpdateUser) onUpdateUser(data.user);
        setStatusMsg('Profile updated successfully');
        setTimeout(() => setStatusMsg(''), 2500);
      }
    } catch (err) {
      console.error('saveProfile error:', err.message);
      setStatusMsg('Failed to update profile');
    } finally {
      setSaving(false);
      setIsEditingName(false);
      setIsEditingAbout(false);
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
            <User size={20} />
            <h3>Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded-full transition-colors text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Avatar with Camera upload */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar src={profilePic} name={name} size={110} />
              <div className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={26} />
                <span className="text-[11px] font-medium mt-1">CHANGE</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-[#8696a0] mt-2">Click avatar to change photo</p>
          </div>

          {/* Name Field */}
          <div className="bg-[#f0f2f5] p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-[#00a884] font-semibold block">Your Name</span>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  maxLength={25}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full bg-white px-2 py-1 text-sm border-b-2 border-[#00a884] focus:outline-none rounded"
                />
                <button
                  type="button"
                  onClick={() => saveProfile({ name })}
                  disabled={saving || !name.trim()}
                  className="p-1 text-[#00a884] hover:bg-black/5 rounded cursor-pointer"
                >
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#111b21]">{name}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="text-[#8696a0] hover:text-[#00a884] p-1 cursor-pointer"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            )}
            <p className="text-[11px] text-[#8696a0]">This name is visible to your WhatsApp contacts.</p>
          </div>

          {/* About / Status Field */}
          <div className="bg-[#f0f2f5] p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-[#00a884] font-semibold block">About</span>
            {isEditingAbout ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={about}
                  maxLength={120}
                  onChange={(e) => setAbout(e.target.value)}
                  autoFocus
                  className="w-full bg-white px-2 py-1 text-sm border-b-2 border-[#00a884] focus:outline-none rounded"
                />
                <button
                  type="button"
                  onClick={() => saveProfile({ about })}
                  disabled={saving}
                  className="p-1 text-[#00a884] hover:bg-black/5 rounded cursor-pointer"
                >
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#54656f]">{about || 'Hey there! I am using WhatsApp.'}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingAbout(true)}
                  className="text-[#8696a0] hover:text-[#00a884] p-1 cursor-pointer"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div className="space-y-3 pt-1 border-t border-[#e9edef]">
            {user?.phone && (
              <div className="flex items-center gap-3 text-sm text-[#54656f]">
                <Phone size={17} className="text-[#8696a0]" />
                <div>
                  <span className="text-[11px] text-[#8696a0] block">Phone</span>
                  <span className="text-[#111b21] font-medium">{user.phone}</span>
                </div>
              </div>
            )}
            {user?.email && (
              <div className="flex items-center gap-3 text-sm text-[#54656f]">
                <Mail size={17} className="text-[#8696a0]" />
                <div>
                  <span className="text-[11px] text-[#8696a0] block">Email</span>
                  <span className="text-[#111b21] font-medium">{user.email}</span>
                </div>
              </div>
            )}
          </div>

          {statusMsg && (
            <p className="text-xs text-center font-medium text-[#00a884]">{statusMsg}</p>
          )}

          {/* Logout Action */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="w-full mt-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileModal;
