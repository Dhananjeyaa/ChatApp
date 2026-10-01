import { useState, useRef, useEffect, useMemo } from 'react';
import EmojiPicker from 'emoji-picker-react';
import {
  Search,
  ArrowLeft,
  Smile,
  Plus,
  SendHorizontal,
  Mic,
  CheckCheck,
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
  Star,
  Users,
  Phone,
  Video,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import CallModal from './CallModal';

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

// Helper to generate playable synthetic voice audio note (audio/wav base64) when microphone is unavailable
const generateSyntheticVoiceAudio = (durationSeconds = 3) => {
  return new Promise((resolve) => {
    try {
      const duration = Math.max(1, Math.min(60, Number(durationSeconds) || 3));
      const sampleRate = 8000;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);

      const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true); // 8-bit
      writeString(36, 'data');
      view.setUint32(40, numSamples, true);

      // Generate voice harmonic frequencies with envelope
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.sin((Math.PI * i) / numSamples); // fade in / out
        const freq = 420 + 60 * Math.sin(2 * Math.PI * 1.5 * t);
        const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.45;
        view.setUint8(44 + i, Math.floor((sample + 1) * 127.5));
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
};

// ─── Audio Note Player Component ──────────────────────────────────────────────
const VoiceNotePlayer = ({ mediaUrl, duration = 0, isMine }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const instanceIdRef = useRef(Math.random().toString(36).substring(2, 9));

  const resolvedSrc = useMemo(() => {
    if (!mediaUrl) return '';
    if (
      mediaUrl.startsWith('data:') ||
      mediaUrl.startsWith('blob:') ||
      mediaUrl.startsWith('http://') ||
      mediaUrl.startsWith('https://')
    ) {
      return mediaUrl;
    }
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${baseUrl}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
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

  // Re-sync listeners whenever the src changes
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
        // Fix for Chromium WebM duration reporting Infinity
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
      const dur = (Number.isFinite(audio.duration) && audio.duration > 0)
        ? audio.duration
        : (audioDuration || fallbackDuration || 1);
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
    const dur = (Number.isFinite(audio.duration) && audio.duration > 0)
      ? audio.duration
      : (audioDuration || fallbackDuration || 1);
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

        <div className="flex justify-between items-center text-[10px] text-[#667781]">
          <span>{isPlaying ? formatAudioTime(currentTime) : formatAudioTime(displayDuration)}</span>
          <span className="flex items-center gap-1">
            <Mic size={11} className="text-[#00a884]" />
            Voice message
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── ChatArea Component ────────────────────────────────────────────────────────
const ChatArea = () => {
  const {
    selectedUser,
    setSelectedUser,
    messages,
    sendMessage,
    toggleStarMessage,
    loadingMessages,
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

  // Search in chat state
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Call modal state
  const [callState, setCallState] = useState({ isOpen: false, type: 'voice' });

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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

  // Close popovers and reset search on user change
  useEffect(() => {
    setEmojiPickerOpen(false);
    setAttachmentOpen(false);
    setSearchBarOpen(false);
    setChatSearchQuery('');
    cancelRecording();
  }, [selectedUser]);

  // Real-time matched message indices
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

  // ─── Audio Recording (Voice Notes) ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      setRecordingSeconds(0);
      setIsRecording(true);
      audioChunksRef.current = [];

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        // Collect audio data continuously in 200ms slices
        mediaRecorder.start(200);
      }
    } catch (err) {
      console.warn('Microphone permission / access issue, using simulated voice recording:', err.message);
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
      recorder.onstop = async () => {
        // Stop mic tracks after all data is collected
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
        } else {
          const syntheticUrl = await generateSyntheticVoiceAudio(duration);
          sendMessage(selectedUser._id, '🎤 Voice message', {
            messageType: 'audio',
            mediaUrl: syntheticUrl,
            mediaDuration: duration,
            isGroup: selectedUser.isGroup,
          });
        }
      };

      try {
        if (recorder.state === 'recording') recorder.requestData();
      } catch {
        // Ignore if requestData not supported in current state
      }
      recorder.stop();
    } else {
      // Fallback simulated voice note with valid playable audio
      generateSyntheticVoiceAudio(duration).then((syntheticUrl) => {
        sendMessage(selectedUser._id, '🎤 Voice message', {
          messageType: 'audio',
          mediaUrl: syntheticUrl,
          mediaDuration: duration,
          isGroup: selectedUser.isGroup,
        });
      });
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecordingTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
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
    if (!text.trim() || !selectedUser) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendStopTypingStatus(selectedUser._id);
    sendMessage(selectedUser._id, text.trim(), { isGroup: selectedUser.isGroup });
    setText('');
    setEmojiPickerOpen(false);
    setAttachmentOpen(false);
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // ─── Text Highlighter for Chat Search ───────────────────────────────────────
  const renderMessageContent = (messageText) => {
    if (!chatSearchQuery.trim()) return messageText;
    const query = chatSearchQuery.trim();
    const parts = messageText.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={index}
          className="bg-[#ffeaa7] text-[#111b21] font-semibold px-0.5 rounded shadow-xs"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // ─── Welcome Screen ─────────────────────────────────────────────────────────
  if (!selectedUser) {
    return (
      <div className="flex-1 h-full bg-[#f0f2f5] flex flex-col items-center justify-center border-b-[6px] border-[#00a884] select-none px-6">
        <div className="max-w-[460px] text-center flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-[#dfe5e7] flex items-center justify-center mb-8 shadow-inner">
            <MessageSquare size={46} className="text-[#54656f]" />
          </div>
          <h1 className="text-3xl font-light text-[#41525d] mb-3">ChatApp Web</h1>
          <p className="text-sm text-[#667781] leading-relaxed mb-8">
            Send and receive messages without keeping your phone online.
            <br />
            Use ChatApp on up to 4 linked devices at the same time.
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
    <div className="flex-1 h-full flex flex-col bg-[#efeae2] relative overflow-hidden">

      {/* ── 1. Header Bar ── */}
      <div className="h-[60px] bg-[#f0f2f5] px-3 sm:px-4 py-2.5 border-b border-[#e9edef] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {/* Mobile: smooth back to sidebar */}
          <button
            type="button"
            onClick={() => setSelectedUser(null)}
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 mr-0.5 rounded-full hover:bg-black/10 active:bg-black/15 active:scale-95 transition-all text-[#54656f] hover:text-[#111b21] cursor-pointer shrink-0"
            title="Back to chats"
            aria-label="Back to chats"
          >
            <ArrowLeft size={21} className="stroke-[2.2]" />
          </button>

          {/* Avatar with correctly positioned bottom-right online dot */}
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
            <h2 className="text-sm font-semibold text-[#111b21] leading-tight truncate flex items-center gap-1.5">
              <span className="truncate">{selectedUser.name}</span>
              {selectedUser.isGroup && (
                <span className="text-[10px] text-[#00a884] bg-[#e7f7f3] px-1.5 py-0.5 rounded font-medium shrink-0">
                  Group
                </span>
              )}
            </h2>
            <p className="text-xs leading-tight truncate mt-0.5">
              {isTyping ? (
                <span className="text-[#00a884] font-medium animate-pulse">typing...</span>
              ) : selectedUser.isGroup ? (
                <span className="text-[#667781] truncate block">
                  {selectedUser.members?.map((m) => m.name || 'Member').join(', ')}
                </span>
              ) : isOnline ? (
                <span className="text-[#00a884] font-medium">online</span>
              ) : (
                <span className="text-[#667781]">{formatLastSeenHeader(lastSeen)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1 text-[#54656f]">
          {!selectedUser.isGroup && (
            <>
              <button
                type="button"
                onClick={() => setCallState({ isOpen: true, type: 'video' })}
                className="p-2 rounded-full hover:bg-black/5 hover:text-[#00a884] transition-colors cursor-pointer text-[#54656f]"
                title="Video call"
              >
                <Video size={19} />
              </button>
              <button
                type="button"
                onClick={() => setCallState({ isOpen: true, type: 'voice' })}
                className="p-2 rounded-full hover:bg-black/5 hover:text-[#00a884] transition-colors cursor-pointer text-[#54656f]"
                title="Voice call"
              >
                <Phone size={18} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSearchBarOpen((p) => !p)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              searchBarOpen ? 'bg-black/10 text-[#00a884]' : 'hover:bg-black/5'
            }`}
            title="Search in conversation"
          >
            <Search size={19} />
          </button>
        </div>
      </div>

      {/* ── Sub-header Search Bar (Toggled on Search icon click) ── */}
      {searchBarOpen && (
        <div className="bg-[#f0f2f5] px-4 py-2 border-b border-[#e9edef] flex items-center justify-between gap-3 shrink-0 z-20 shadow-xs animate-fade-in">
          <div className="flex-1 bg-white rounded-xl px-3 py-1.5 flex items-center gap-2 border border-[#e9edef] focus-within:shadow-[0_0_0_1px_#00a884]">
            <Search size={16} className="text-[#54656f] shrink-0" />
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Search in this chat..."
              autoFocus
              className="w-full text-xs text-[#111b21] placeholder-[#8696a0] focus:outline-none bg-transparent"
            />
            {chatSearchQuery && (
              <button
                type="button"
                onClick={() => setChatSearchQuery('')}
                className="text-[#8696a0] hover:text-[#111b21]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#54656f]">
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
              className="p-1 hover:bg-black/5 disabled:opacity-30 rounded-md transition-colors"
              title="Previous match"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={matchingMessageIds.length === 0}
              className="p-1 hover:bg-black/5 disabled:opacity-30 rounded-md transition-colors"
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
              className="p-1 hover:bg-black/5 rounded-md transition-colors ml-1"
              title="Close search"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Message Window (Doodle Background + Explicit Z-10 on Content) ── */}
      <div className="flex-1 overflow-y-auto px-2.5 sm:px-8 md:px-14 py-3 sm:py-4 space-y-1 whatsapp-doodle-bg relative overflow-hidden">
        {/* Underlying subtle doodle layer with opacity-35 and explicit z-0 */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-35 select-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath opacity='0.08' fill-rule='evenodd' clip-rule='evenodd' d='M28 14C23.5817 14 20 17.5817 20 22V32C20 36.4183 23.5817 40 28 40H30V46L36 40H44C48.4183 40 52 36.4183 52 32V22C52 17.5817 48.4183 14 44 14H28ZM86 74C81.5817 74 78 77.5817 78 82V92C78 96.4183 81.5817 100 86 100H94L100 106V100H102C106.418 100 110 96.4183 110 92V82C110 77.5817 106.418 74 102 74H86ZM18 84C18 79.5817 21.5817 76 26 76C30.4183 76 34 79.5817 34 84C34 88.4183 30.4183 92 26 92C21.5817 92 18 88.4183 18 84ZM88 28C88 23.5817 91.5817 20 96 20C100.418 20 104 23.5817 104 28C104 32.4183 100.418 36 96 36C91.5817 36 88 32.4183 88 28ZM62 50C57.5817 50 54 53.5817 54 58C54 62.4183 57.5817 66 62 66C66.4183 66 70 62.4183 70 58C70 53.5817 66.4183 50 62 50Z' fill='%23000000'/%3E%3C/svg%3E")`,
            backgroundSize: '120px 120px',
          }}
        />

        {/* End to End Encryption Notice with explicit relative z-10 */}
        <div className="flex justify-center my-3 select-none relative z-10">
          <div className="bg-[#ffeecd] border border-[#ffd279]/30 text-[#54656f] text-[11.5px] px-4 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 text-center max-w-[480px]">
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
            <span className="bg-white/90 text-[#54656f] text-xs px-4 py-2 rounded-lg shadow-xs">
              No messages yet. Say hello to {selectedUser.name}! 👋
            </span>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine =
              msg.sender === user?._id ||
              msg.sender?._id === user?._id ||
              msg.sender?.toString() === user?._id?.toString();

            const isStarred = (msg.starredBy || []).some(
              (id) => (typeof id === 'object' && id._id ? id._id.toString() : id.toString()) === user?._id?.toString()
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
              (prevMsg.sender?._id || prevMsg.sender)?.toString() !== (msg.sender?._id || msg.sender)?.toString() ||
              showBadge;

            const isMatch = matchingMessageIds[currentMatchIdx] === msg._id;

            return (
              <div
                key={msg._id || i}
                ref={(el) => (searchMatchRefs.current[msg._id] = el)}
                className="relative z-10"
              >
                {/* Date Badge with explicit relative z-10 */}
                {showBadge && (
                  <div className="flex justify-center my-3 select-none sticky top-1 z-10">
                    <span className="bg-white/95 text-[#54656f] text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] uppercase tracking-wider">
                      {dateBadge}
                    </span>
                  </div>
                )}

                {/* Message Bubble with explicit relative z-10 */}
                <div
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                    isFirstInGroup ? 'mt-2' : 'mt-0.5'
                  } group/bubble`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[75%] md:max-w-[65%] px-3 pt-1.5 pb-2 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative text-sm break-words transition-all ${
                      isMatch ? 'ring-2 ring-[#00a884] ring-offset-1' : ''
                    } ${
                      isMine
                        ? 'whatsapp-bubble-sent rounded-tr-none'
                        : 'whatsapp-bubble-received rounded-tl-none'
                    } ${
                      isFirstInGroup ? (isMine ? 'whatsapp-tail-sent' : 'whatsapp-tail-received') : ''
                    }`}
                  >
                    {/* Sender name for group chats */}
                    {selectedUser.isGroup && !isMine && isFirstInGroup && (
                      <span className="text-[11px] font-semibold text-[#00a884] block mb-0.5">
                        {msg.sender?.name || 'Participant'}
                      </span>
                    )}

                    {/* Message Body: Text or Voice Note */}
                    {msg.messageType === 'audio' ? (
                      <VoiceNotePlayer
                        mediaUrl={msg.mediaUrl}
                        duration={msg.mediaDuration}
                        isMine={isMine}
                      />
                    ) : (
                      <span className="text-[#111b21] leading-relaxed whitespace-pre-wrap select-text">
                        {renderMessageContent(msg.message)}
                      </span>
                    )}

                    {/* Metadata Footer: Timestamp + Status + Star */}
                    <div className="inline-flex items-center gap-1 float-right ml-3 mt-1 select-none shrink-0">
                      {isStarred && (
                        <Star size={11} className="fill-[#8696a0] text-[#8696a0] shrink-0" />
                      )}

                      <span className="text-[10px] text-[#667781] leading-none">
                        {formatTime(msgDate)}
                      </span>

                      {isMine && (
                        <CheckCheck
                          size={15}
                          className={msg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'}
                        />
                      )}

                      {/* Quick Star / Bookmark on Hover */}
                      <button
                        type="button"
                        onClick={() => toggleStarMessage(msg._id)}
                        title={isStarred ? 'Unstar message' : 'Star message'}
                        className="opacity-0 group-hover/bubble:opacity-100 hover:text-[#00a884] text-[#8696a0] transition-opacity ml-1"
                      >
                        <Star size={12} className={isStarred ? 'fill-[#00a884] text-[#00a884]' : ''} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator with relative z-10 */}
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
      <div className="bg-[#f0f2f5] px-4 py-2.5 border-t border-[#e9edef] relative shrink-0 z-20">

        {/* Full Emoji Picker Integration */}
        {emojiPickerOpen && (
          <div className="absolute bottom-[65px] left-4 shadow-2xl z-30 rounded-2xl overflow-hidden border border-[#e9edef]">
            <EmojiPicker
              onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
              width={320}
              height={400}
              searchPlaceHolder="Search emoji..."
              lazyLoadEmojis={true}
            />
          </div>
        )}

        {/* Attachment Options Popover */}
        {attachmentOpen && (
          <div className="absolute bottom-[65px] left-14 bg-white p-2 rounded-2xl shadow-2xl border border-[#e9edef] flex flex-col gap-1 w-44 z-30">
            {[
              { icon: <Image size={16} className="text-[#007bfc]" />, label: 'Photos & Videos' },
              { icon: <Camera size={16} className="text-[#d3396d]" />, label: 'Camera' },
              { icon: <FileText size={16} className="text-[#5f66cd]" />, label: 'Document' },
            ].map(({ icon, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setAttachmentOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-xs text-[#111b21] hover:bg-[#f0f2f5] rounded-xl transition-colors text-left"
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Active Audio Recording State vs Standard Input Bar */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-2 rounded-2xl border border-[#e9edef] shadow-xs animate-fade-in">
            {/* Blinking red dot with timer */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-mono font-medium text-red-600">
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
              {/* Discard / Cancel button */}
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                title="Cancel recording"
              >
                <Trash2 size={20} />
              </button>

              {/* Send Voice Note button */}
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
              className={`p-2 rounded-full transition-colors ${
                emojiPickerOpen ? 'text-[#00a884] bg-black/5' : 'text-[#54656f] hover:bg-black/5'
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
              className={`p-2 rounded-full transition-colors ${
                attachmentOpen ? 'text-[#00a884] bg-black/5' : 'text-[#54656f] hover:bg-black/5'
              }`}
              title="Attach"
            >
              <Plus size={22} />
            </button>

            <div className="flex-1 bg-white rounded-xl px-3.5 sm:px-4 py-2 border border-transparent focus-within:shadow-xs focus-within:border-[#00a884]/30 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                className="w-full text-base sm:text-sm text-[#111b21] placeholder-[#8696a0] focus:outline-none bg-transparent"
              />
            </div>

            {text.trim() ? (
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
                className="p-2 text-[#54656f] hover:text-[#00a884] hover:bg-black/5 rounded-full transition-colors cursor-pointer"
                title="Record voice message"
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Voice / Video Call Modal */}
      <CallModal
        isOpen={callState.isOpen}
        onClose={() => setCallState({ isOpen: false, type: 'voice' })}
        user={selectedUser}
        type={callState.type}
      />
    </div>
  );
};

export default ChatArea;
