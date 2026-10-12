import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import EmojiPicker from 'emoji-picker-react';
import {
  Search,
  ArrowLeft,
  Smile,
  Plus,
  SendHorizontal,
  Mic,
  Image,
  FileText,
  Camera,
  Lock,
  MessageSquare,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Play,
  Pause,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import MessageItem from './MessageItem';
import DeleteMessageModal from './DeleteMessageModal';

// ─── Formatters ───────────────────────────────────────────────────────────────
const formatTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDateBadge = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'TODAY';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
    return 'YESTERDAY';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

const formatLastSeenHeader = (d) => {
  if (!d) return 'offline';
  const date = new Date(d);
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

// ─── Audio Note Player Component ──────────────────────────────────────────────
const VoiceNotePlayer = memo(({ mediaUrl, duration = 0, isMine }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const instanceIdRef = useRef(Math.random().toString(36).substring(2, 9));

  // Robust URL resolution: cleanly handles base64, blob, HTTP(S), and relative server paths
  const resolvedSrc = useMemo(() => {
    if (!mediaUrl || typeof mediaUrl !== 'string') return '';
    const cleanUrl = mediaUrl.trim();
    if (!cleanUrl) return '';

    // If data: or blob: directly
    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
      return cleanUrl;
    }

    // Recover if data:audio was accidentally appended to a base URL (e.g. http://localhost:5000/data:audio/...)
    const dataAudioIdx = cleanUrl.indexOf('data:audio');
    if (dataAudioIdx !== -1) {
      return cleanUrl.slice(dataAudioIdx);
    }

    // Full absolute URL
    if (/^https?:\/\//i.test(cleanUrl)) {
      return cleanUrl;
    }

    // Clean relative path from backend media directory
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const cleanPath = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
    return `${baseUrl}${cleanPath}`;
  }, [mediaUrl]);

  const parsedDuration = Number(duration);
  const fallbackDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0;
  const [audioDuration, setAudioDuration] = useState(fallbackDuration);

  useEffect(() => {
    setAudioDuration(fallbackDuration);
  }, [fallbackDuration]);

  // Pause other players when another voice note starts
  useEffect(() => {
    const handleGlobalPause = (e) => {
      if (e.detail?.id !== instanceIdRef.current && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('chatapp-audio-play', handleGlobalPause);
    return () => window.removeEventListener('chatapp-audio-play', handleGlobalPause);
  }, []);

  // Sync event listeners whenever the src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      } else if (audio.duration === Infinity) {
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setAudioDuration(audio.duration);
          }
          audio.currentTime = 0;
        };
      }
    };

    const handleTimeUpdate = () => {
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : audioDuration || fallbackDuration || 1;
      if (dur > 0) {
        setProgress(Math.min(100, (audio.currentTime / dur) * 100));
      }
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [resolvedSrc, audioDuration, fallbackDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;
    if (isPlaying) {
      audio.pause();
    } else {
      window.dispatchEvent(
        new CustomEvent('chatapp-audio-play', { detail: { id: instanceIdRef.current } })
      );
      audio.play().catch((err) => {
        console.warn('Audio play failed:', err.message);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : audioDuration || fallbackDuration || 1;
    const targetTime = ratio * dur;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    setProgress(ratio * 100);
  };

  const formatAudioTime = (sec) => {
    const s = Math.round(sec);
    const mins = Math.floor(s / 60);
    const remaining = s % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const displayDuration = audioDuration || fallbackDuration || 0;

  return (
    <div className="flex items-center gap-3 py-1 min-w-[210px] select-none">
      {resolvedSrc && <audio ref={audioRef} src={resolvedSrc} preload="metadata" />}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!resolvedSrc}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-[#00a884] text-white hover:bg-[#008069] shadow-xs cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        {/* Waveform bars with click to seek */}
        <div
          className="flex items-center gap-1 h-5 cursor-pointer py-1"
          onClick={handleSeek}
          title="Click to seek"
        >
          {[40, 70, 30, 90, 60, 100, 50, 80, 40, 70, 90, 60, 30, 80, 50].map((h, i) => {
            const barProgress = (i / 15) * 100;
            const isFilled = progress >= barProgress;
            return (
              <span
                key={i}
                className={`w-1 rounded-full transition-colors pointer-events-none ${
                  isFilled ? 'bg-[#00a884]' : isMine ? 'bg-[#8696a0]/50' : 'bg-[#8696a0]/40'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-[#667781] dark:text-[#8696a0]">
          <span>{isPlaying ? formatAudioTime(currentTime) : formatAudioTime(displayDuration)}</span>
          <span className="flex items-center gap-1">
            <Mic size={11} className="text-[#00a884]" />
            Voice message
          </span>
        </div>
      </div>
    </div>
  );
});

VoiceNotePlayer.displayName = 'VoiceNotePlayer';

// ─── ChatArea Component ───────────────────────────────────────────────────────
const ChatArea = memo(() => {
  const {
    selectedUser,
    setSelectedUser,
    messages,
    sendMessage,
    toggleStarMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    loadingMessages,
    loadingOlderMessages,
    hasMoreMessages,
    loadOlderMessages,
    typingUser,
    onlineUsers = [],
    userLastSeenMap,
    sendTypingStatus,
    sendStopTypingStatus,
  } = useChat();

  const { user } = useAuth();
  const [text, setText] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Search in chat state
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // 3-Way Message Deletion state
  const [deleteModalMsg, setDeleteModalMsg] = useState(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micNotice, setMicNotice] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const searchMatchRefs = useRef({});

  // Auto-scroll on new messages / typing indicator
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Close popovers and reset search on active user change
  useEffect(() => {
    setEmojiPickerOpen(false);
    setAttachmentOpen(false);
    setSelectedFile(null);
    setSearchBarOpen(false);
    setChatSearchQuery('');
    setMicNotice('');
    cancelRecording();
  }, [selectedUser]);

  // Real-time matched message indices for in-chat search
  const matchingMessageIds = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase();
    return messages
      .filter((m) => m.message?.toLowerCase().includes(q))
      .map((m) => m._id);
  }, [messages, chatSearchQuery]);

  useEffect(() => {
    setCurrentMatchIdx(0);
    if (matchingMessageIds.length > 0) {
      const firstId = matchingMessageIds[0];
      searchMatchRefs.current[firstId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [matchingMessageIds]);

  const handleNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const next = (currentMatchIdx + 1) % matchingMessageIds.length;
    setCurrentMatchIdx(next);
    const targetId = matchingMessageIds[next];
    searchMatchRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prev = (currentMatchIdx - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setCurrentMatchIdx(prev);
    const targetId = matchingMessageIds[prev];
    searchMatchRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ─── 3-Way Message Deletion Actions ─────────────────────────────────────────
  const handleRequestDelete = useCallback((msg) => {
    setDeleteModalMsg(msg);
  }, []);

  const handleDeleteForMe = useCallback(async () => {
    if (!deleteModalMsg?._id || isDeletingMessage) return;
    setIsDeletingMessage(true);
    try {
      await deleteMessageForMe(deleteModalMsg._id);
      setDeleteModalMsg(null);
    } catch (err) {
      console.error('Delete for me error:', err.message);
    } finally {
      setIsDeletingMessage(false);
    }
  }, [deleteModalMsg, isDeletingMessage, deleteMessageForMe]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!deleteModalMsg?._id || isDeletingMessage) return;
    setIsDeletingMessage(true);
    try {
      await deleteMessageForEveryone(deleteModalMsg._id);
      setDeleteModalMsg(null);
    } catch (err) {
      console.error('Delete for everyone error:', err.message);
    } finally {
      setIsDeletingMessage(false);
    }
  }, [deleteModalMsg, isDeletingMessage, deleteMessageForEveryone]);

  // ─── Audio Recording (Voice Notes with Clean Permission Notice) ─────────────
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicNotice('Microphone recording is not supported in this browser.');
      setTimeout(() => setMicNotice(''), 4000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);
      setMicNotice('');

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      let options;
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(200);
    } catch (err) {
      console.warn('Microphone permission access failed:', err.message);
      setIsRecording(false);
      setRecordingSeconds(0);
      setMicNotice('Microphone permission was denied. Please allow microphone access in browser settings.');
      setTimeout(() => setMicNotice(''), 4500);
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const sendRecording = () => {
    const duration = recordingSeconds || 1;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        recorder.stream?.getTracks().forEach((track) => track.stop());
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (chunks.length > 0) {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            sendMessage(selectedUser._id, '🎤 Voice message', {
              messageType: 'audio',
              mediaUrl: reader.result,
              mediaDuration: duration,
              isGroup: selectedUser.isGroup,
            });
          };
          reader.readAsDataURL(blob);
        }
      };

      try {
        if (recorder.state === 'recording') recorder.requestData();
      } catch {
        // Ignore requestData error if already completed
      }
      recorder.stop();
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecordingTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  // ─── File Attachment Handlers ─────────────────────────────────────────────
  const handleFileSelect = (e, type = 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        file,
        previewUrl: reader.result,
        type: file.type.startsWith('image/') ? 'image' : type,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    setAttachmentOpen(false);
    e.target.value = '';
  };

  const cancelSelectedFile = () => {
    setSelectedFile(null);
  };

  // ─── Input Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setText(e.target.value);
    if (selectedUser?._id) {
      sendTypingStatus(selectedUser._id);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendStopTypingStatus(selectedUser._id), 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && !selectedFile) || !selectedUser) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendStopTypingStatus(selectedUser._id);

    if (selectedFile) {
      sendMessage(selectedUser._id, text.trim() || selectedFile.name, {
        isGroup: selectedUser.isGroup,
        messageType: selectedFile.type,
        mediaUrl: selectedFile.previewUrl,
      });
      setSelectedFile(null);
    } else {
      sendMessage(selectedUser._id, text.trim(), { isGroup: selectedUser.isGroup });
    }

    setText('');
    setEmojiPickerOpen(false);
    setAttachmentOpen(false);
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // ─── Welcome Screen ─────────────────────────────────────────────────────────
  if (!selectedUser) {
    return (
      <div className="flex-1 h-full bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col items-center justify-center border-b-[6px] border-[#00a884] select-none px-6 transition-colors">
        <div className="max-w-[460px] text-center flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-[#dfe5e7] dark:bg-[#202c33] flex items-center justify-center mb-8 shadow-inner">
            <MessageSquare size={46} className="text-[#54656f] dark:text-[#aebac1]" />
          </div>
          <h1 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-3">ChatApp Web</h1>
          <p className="text-sm text-[#667781] dark:text-[#8696a0] leading-relaxed mb-8">
            Send and receive messages in real time.
            <br />
            Select a conversation from the sidebar to start chatting.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
            <Lock size={13} />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const isOnline = !selectedUser.isGroup && onlineUsers.includes(selectedUser._id);
  const isTyping = typingUser === selectedUser._id;
  const lastSeen = userLastSeenMap[selectedUser._id] || selectedUser.lastSeen;

  let lastDateLabel = '';

  return (
    <div className="flex-1 h-full flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden transition-colors">
      {/* ── 1. Header Bar ── */}
      <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] px-3 sm:px-4 py-2.5 border-b border-[#e9edef] dark:border-[#222e35] flex items-center justify-between shrink-0 z-20 transition-colors">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {/* Mobile: back to sidebar */}
          <button
            type="button"
            onClick={() => setSelectedUser(null)}
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 mr-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all text-[#54656f] dark:text-[#aebac1] cursor-pointer shrink-0"
            title="Back to chats"
            aria-label="Back to chats"
          >
            <ArrowLeft size={21} className="stroke-[2.2]" />
          </button>

          {/* Avatar */}
          {selectedUser.isGroup ? (
            <div className="w-10 h-10 rounded-full bg-[#00a884]/15 flex items-center justify-center text-[#00a884] shrink-0 font-bold">
              <Users size={20} />
            </div>
          ) : (
            <Avatar
              src={selectedUser.profilePic}
              name={selectedUser.name}
              size={40}
              online={isOnline}
            />
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef] leading-tight truncate flex items-center gap-1.5">
              <span className="truncate">{selectedUser.name}</span>
              {selectedUser.isGroup && (
                <span className="text-[10px] text-[#00a884] bg-[#e7f7f3] dark:bg-[#00a884]/20 px-1.5 py-0.5 rounded font-medium shrink-0">
                  Group
                </span>
              )}
            </h2>
            <p className="text-xs leading-tight truncate mt-0.5">
              {isTyping ? (
                <span className="text-[#00a884] font-medium animate-pulse">typing...</span>
              ) : selectedUser.isGroup ? (
                <span className="text-[#667781] dark:text-[#8696a0] truncate block">
                  {selectedUser.members?.map((m) => m.name || 'Member').join(', ')}
                </span>
              ) : isOnline ? (
                <span className="text-[#00a884] font-medium">online</span>
              ) : (
                <span className="text-[#667781] dark:text-[#8696a0]">{formatLastSeenHeader(lastSeen)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1 text-[#54656f] dark:text-[#aebac1]">
          <button
            type="button"
            onClick={() => setSearchBarOpen((p) => !p)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              searchBarOpen ? 'bg-black/10 dark:bg-white/10 text-[#00a884]' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title="Search in conversation"
          >
            <Search size={19} />
          </button>
        </div>
      </div>

      {/* ── Sub-header Search Bar ── */}
      {searchBarOpen && (
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 border-b border-[#e9edef] dark:border-[#222e35] flex items-center justify-between gap-3 shrink-0 z-20 shadow-xs animate-in fade-in duration-150">
          <div className="flex-1 bg-white dark:bg-[#111b21] rounded-xl px-3 py-1.5 flex items-center gap-2 border border-[#e9edef] dark:border-[#222e35] focus-within:shadow-[0_0_0_1px_#00a884]">
            <Search size={16} className="text-[#54656f] dark:text-[#8696a0] shrink-0" />
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search in this chat..."
              autoFocus
              className="w-full text-xs text-[#111b21] dark:text-[#e9edef] placeholder-[#8696a0] focus:outline-none bg-transparent"
            />
            {chatSearchQuery && (
              <button
                type="button"
                onClick={() => setChatSearchQuery('')}
                className="text-[#8696a0] hover:text-[#111b21] dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#54656f] dark:text-[#8696a0]">
            <span className="text-[11px] font-medium shrink-0">
              {matchingMessageIds.length > 0
                ? `${currentMatchIdx + 1} of ${matchingMessageIds.length}`
                : chatSearchQuery
                ? 'No matches'
                : ''}
            </span>

            <button
              type="button"
              onClick={handlePrevMatch}
              disabled={matchingMessageIds.length === 0}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-colors"
              title="Previous match"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={matchingMessageIds.length === 0}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 rounded-md transition-colors"
              title="Next match"
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchBarOpen(false);
                setChatSearchQuery('');
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors ml-1"
              title="Close search"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Mic Permission Notice Banner ── */}
      {micNotice && (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 z-20 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{micNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setMicNotice('')}
            className="p-1 hover:bg-amber-500/10 rounded-full"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 2. Message Window ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 sm:px-8 md:px-14 py-3 sm:py-4 space-y-1 whatsapp-doodle-bg relative">
        {/* End to End Encryption Notice */}
        <div className="flex justify-center my-3 select-none relative z-10">
          <div className="bg-[#ffeecd] dark:bg-[#182229] border border-[#ffd279]/30 dark:border-[#222e35] text-[#54656f] dark:text-[#8696a0] text-[11.5px] px-4 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 text-center max-w-[480px]">
            <Lock size={12} className="shrink-0 text-[#8696a0]" />
            <span>Messages are end-to-end encrypted. No one outside this chat can read them.</span>
          </div>
        </div>

        {loadingMessages ? (
          <div className="flex items-center justify-center py-12 text-[#8696a0] text-sm gap-2 relative z-10">
            <div className="w-5 h-5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-16 relative z-10">
            <span className="bg-white/90 dark:bg-[#202c33] text-[#54656f] dark:text-[#8696a0] text-xs px-4 py-2 rounded-lg shadow-xs">
              No messages yet. Say hello to {selectedUser.name}! 👋
            </span>
          </div>
        ) : (
          <>
            {hasMoreMessages && (
              <div className="flex justify-center my-2 relative z-10">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlderMessages}
                  className="bg-white/90 dark:bg-[#202c33] hover:bg-white dark:hover:bg-[#2a3942] text-[#00a884] text-xs font-medium px-4 py-1.5 rounded-full shadow-xs border border-[#e9edef] dark:border-[#222e35] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingOlderMessages ? (
                    <>
                      <div className="w-3 h-3 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load older messages</span>
                  )}
                </button>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMine =
                msg.sender === user?._id ||
                msg.sender?._id === user?._id ||
                msg.sender?.toString() === user?._id?.toString();

              const isStarred = (msg.starredBy || []).some(
                (id) =>
                  (typeof id === 'object' && id._id ? id._id.toString() : id.toString()) ===
                  user?._id?.toString()
              );

              const msgDate = msg.createdAt || msg.timestamp;
              const dateBadge = formatDateBadge(msgDate);
              let showBadge = false;
              if (dateBadge && dateBadge !== lastDateLabel) {
                showBadge = true;
                lastDateLabel = dateBadge;
              }

              const prevMsg = messages[i - 1];
              const isFirstInGroup =
                !prevMsg ||
                (prevMsg.sender?._id || prevMsg.sender)?.toString() !==
                  (msg.sender?._id || msg.sender)?.toString() ||
                showBadge;

              const isMatch = matchingMessageIds[currentMatchIdx] === msg._id;

              return (
                <MessageItem
                  key={msg._id || i}
                  msg={msg}
                  isMine={isMine}
                  isStarred={isStarred}
                  showBadge={showBadge}
                  dateBadge={dateBadge}
                  isFirstInGroup={isFirstInGroup}
                  isMatch={isMatch}
                  isGroup={selectedUser.isGroup}
                  chatSearchQuery={chatSearchQuery}
                  onToggleStar={toggleStarMessage}
                  onRequestDelete={handleRequestDelete}
                  VoicePlayerComponent={VoiceNotePlayer}
                  measureRef={(el) => (searchMatchRefs.current[msg._id] = el)}
                />
              );
            })}
          </>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start mt-2 relative z-10">
            <div className="whatsapp-bubble-received px-3.5 py-2.5 rounded-lg rounded-tl-none shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 3. Footer Bar & Input / Audio Recording Bar ── */}
      <div
        className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 pt-2.5 border-t border-[#e9edef] dark:border-[#222e35] relative shrink-0 z-20 transition-colors"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}
      >
        {/* Emoji Picker Integration — mobile-responsive width & position */}
        {emojiPickerOpen && (
          <div
            className="absolute bottom-[65px] left-0 sm:left-4 shadow-2xl z-30 rounded-none sm:rounded-2xl overflow-hidden border-t sm:border border-[#e9edef] dark:border-[#222e35]"
            style={{ width: 'min(320px, 100vw)' }}
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
              width="100%"
              height={Math.min(400, window.innerHeight * 0.5)}
              searchPlaceHolder="Search emoji..."
              lazyLoadEmojis={true}
            />
          </div>
        )}

        {/* Hidden File Inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={docInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'file')}
        />

        {/* Attachment Options Popover */}
        {attachmentOpen && (
          <div className="absolute bottom-[65px] left-14 bg-white dark:bg-[#233138] p-2 rounded-2xl shadow-2xl border border-[#e9edef] dark:border-[#222e35] flex flex-col gap-1 w-48 z-30 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 text-xs text-[#111b21] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] rounded-xl transition-colors text-left cursor-pointer"
            >
              <Image size={16} className="text-[#007bfc]" />
              <span>Photos & Videos</span>
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 text-xs text-[#111b21] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] rounded-xl transition-colors text-left cursor-pointer"
            >
              <Camera size={16} className="text-[#d3396d]" />
              <span>Camera</span>
            </button>
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 text-xs text-[#111b21] dark:text-[#e9edef] hover:bg-[#f0f2f5] dark:hover:bg-[#182229] rounded-xl transition-colors text-left cursor-pointer"
            >
              <FileText size={16} className="text-[#5f66cd]" />
              <span>Document</span>
            </button>
          </div>
        )}

        {/* Attachment Preview Banner */}
        {selectedFile && (
          <div className="mb-2 p-2 bg-white dark:bg-[#111b21] rounded-xl border border-[#e9edef] dark:border-[#222e35] flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {selectedFile.type === 'image' && selectedFile.previewUrl ? (
                <img
                  src={selectedFile.previewUrl}
                  alt="preview"
                  className="w-10 h-10 object-cover rounded-lg shrink-0 border border-[#e9edef] dark:border-[#222e35]"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-[#5f66cd]" />
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-medium text-[#111b21] dark:text-[#e9edef] truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-[#667781] dark:text-[#8696a0]">Ready to send</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelSelectedFile}
              className="p-1 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] rounded-full text-[#667781] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-white transition-colors cursor-pointer"
              title="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Audio Recording State vs Standard Input Bar */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#111b21] px-4 py-2 rounded-2xl border border-[#e9edef] dark:border-[#222e35] shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-mono font-medium text-red-600 dark:text-red-400">
                {formatRecordingTime(recordingSeconds)}
              </span>
            </div>

            {/* Audio Waveform visualization */}
            <div className="flex-1 flex items-center justify-center gap-1 h-6">
              {[20, 60, 40, 90, 30, 80, 50, 100, 70, 40, 85, 30, 95, 60, 40, 75, 50].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-[#00a884] rounded-full animate-pulse"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${(i % 5) * 0.1}s`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors cursor-pointer"
                title="Cancel recording"
              >
                <Trash2 size={20} />
              </button>

              <button
                type="button"
                onClick={sendRecording}
                className="p-2.5 bg-[#00a884] hover:bg-[#008069] text-white rounded-full transition-all active:scale-95 shadow-sm cursor-pointer"
                title="Send voice note"
              >
                <SendHorizontal size={19} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEmojiPickerOpen((p) => !p);
                setAttachmentOpen(false);
              }}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                emojiPickerOpen ? 'text-[#00a884] bg-black/5 dark:bg-white/10' : 'text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Emoji"
            >
              <Smile size={22} />
            </button>

            <button
              type="button"
              onClick={() => {
                setAttachmentOpen((p) => !p);
                setEmojiPickerOpen(false);
              }}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                attachmentOpen ? 'text-[#00a884] bg-black/5 dark:bg-white/10' : 'text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Attach"
            >
              <Plus size={22} />
            </button>

            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-xl px-3.5 sm:px-4 py-2 border border-transparent focus-within:shadow-xs focus-within:border-[#00a884]/30 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={selectedFile ? 'Add a caption...' : 'Type a message'}
                className="w-full text-base sm:text-sm text-[#111b21] dark:text-[#e9edef] placeholder-[#8696a0] focus:outline-none bg-transparent"
              />
            </div>

            {text.trim() || selectedFile ? (
              <button
                type="button"
                onClick={handleSend}
                className="p-2.5 bg-[#00a884] hover:bg-[#008069] text-white rounded-full transition-all active:scale-95 shadow-sm cursor-pointer"
                title="Send"
              >
                <SendHorizontal size={19} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#00a884] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                title="Record voice message"
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 4. 3-Way Message Deletion Modal ── */}
      <DeleteMessageModal
        isOpen={Boolean(deleteModalMsg)}
        onClose={() => setDeleteModalMsg(null)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
        isMine={
          deleteModalMsg
            ? (deleteModalMsg.sender?._id || deleteModalMsg.sender)?.toString() ===
              user?._id?.toString()
            : false
        }
        isDeleting={isDeletingMessage}
      />
    </div>
  );
});

ChatArea.displayName = 'ChatArea';

export { ChatArea as ChatContainer };
export default ChatArea;
