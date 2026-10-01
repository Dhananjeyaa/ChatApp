import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Moon, Sun, Bell, Shield, Volume2, Check } from 'lucide-react';

const WALLPAPERS = [
  { id: 'classic', name: 'Classic Doodle', color: '#efeae2' },
  { id: 'dark-doodle', name: 'Dark Doodle', color: '#0b141a' },
  { id: 'sage', name: 'Soft Sage', color: '#d1e7dd' },
  { id: 'sky', name: 'Sky Blue', color: '#cfe2ff' },
  { id: 'slate', name: 'Slate Gray', color: '#e2e3e5' },
  { id: 'rose', name: 'Soft Rose', color: '#f8d7da' },
  { id: 'teal', name: 'Dark Teal', color: '#12393d' },
];

const SettingsModal = ({ isOpen, onClose }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('chat_theme') || 'light');
  const [activeWallpaper, setActiveWallpaper] = useState(
    () => localStorage.getItem('chat_wallpaper') || 'classic'
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem('chat_sound') !== 'false'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem('chat_notifications') !== 'false'
  );
  const [readReceipts, setReadReceipts] = useState(
    () => localStorage.getItem('chat_receipts') !== 'false'
  );

  useEffect(() => {
    const selected = WALLPAPERS.find((w) => w.id === activeWallpaper) || WALLPAPERS[0];
    document.documentElement.style.setProperty('--chat-wallpaper-color', selected.color);
    localStorage.setItem('chat_wallpaper', selected.id);
  }, [activeWallpaper]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('chat_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleSound = () => {
    const val = !soundEnabled;
    setSoundEnabled(val);
    localStorage.setItem('chat_sound', String(val));
  };

  const toggleNotifications = () => {
    const val = !notificationsEnabled;
    setNotificationsEnabled(val);
    localStorage.setItem('chat_notifications', String(val));
  };

  const toggleReceipts = () => {
    const val = !readReceipts;
    setReadReceipts(val);
    localStorage.setItem('chat_receipts', String(val));
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
        className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl relative border border-[#e9edef] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto animate-in fade-in zoom-in-95 duration-150 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5 font-medium text-lg">
            <Settings size={20} />
            <h3>Settings</h3>
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Theme */}
          <div>
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider block mb-3">
              Theme & Appearance
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#00a884] bg-[#e7f7f3] text-[#00a884]'
                    : 'border-[#e9edef] hover:bg-[#f0f2f5] text-[#54656f]'
                }`}
              >
                <Sun size={17} />
                Light
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#00a884] bg-[#111b21] text-white'
                    : 'border-[#e9edef] hover:bg-[#f0f2f5] text-[#54656f]'
                }`}
              >
                <Moon size={17} />
                Dark
              </button>
            </div>
          </div>

          {/* Wallpaper */}
          <div>
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider block mb-3">
              Chat Wallpaper
            </span>
            <div className="grid grid-cols-4 gap-2.5">
              {WALLPAPERS.map((wp) => {
                const isSelected = activeWallpaper === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => setActiveWallpaper(wp.id)}
                    className={`h-16 rounded-xl relative border-2 transition-all flex flex-col items-center justify-center p-1 overflow-hidden cursor-pointer ${
                      isSelected ? 'border-[#00a884] scale-105' : 'border-transparent hover:scale-102'
                    }`}
                    style={{ backgroundColor: wp.color }}
                    title={wp.name}
                  >
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md">
                        <Check size={12} />
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-medium mt-1 truncate px-1 rounded ${
                        wp.color === '#0b141a' || wp.color === '#12393d'
                          ? 'text-white/90 bg-black/40'
                          : 'text-black/80 bg-white/60'
                      }`}
                    >
                      {wp.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider block mb-3">
              Notifications & Sounds
            </span>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-[#f0f2f5] transition-colors">
                <div className="flex items-center gap-3">
                  <Volume2 size={18} className="text-[#8696a0]" />
                  <div>
                    <span className="text-sm font-medium text-[#111b21] block">Message Sounds</span>
                    <span className="text-xs text-[#8696a0]">Play audio for messages</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={toggleSound}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-[#f0f2f5] transition-colors">
                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-[#8696a0]" />
                  <div>
                    <span className="text-sm font-medium text-[#111b21] block">Notifications</span>
                    <span className="text-xs text-[#8696a0]">Show desktop notifications</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={toggleNotifications}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <span className="text-xs font-semibold text-[#00a884] uppercase tracking-wider block mb-3">
              Privacy
            </span>
            <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-[#f0f2f5] transition-colors">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-[#8696a0]" />
                <div>
                  <span className="text-sm font-medium text-[#111b21] block">Read Receipts</span>
                  <span className="text-xs text-[#8696a0]">Show blue checkmarks when messages are read</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={readReceipts}
                onChange={toggleReceipts}
                className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#00a884] hover:bg-[#008069] text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SettingsModal;
