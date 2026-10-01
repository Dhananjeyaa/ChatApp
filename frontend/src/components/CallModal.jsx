import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Phone,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import Avatar from './Avatar';

const CallModal = ({ isOpen, onClose, user, type = 'voice' }) => {
  const [callStatus, setCallStatus] = useState('Calling...');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === 'video');
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  // Call lifecycle simulation: Calling -> Ringing -> Connected with timer
  useEffect(() => {
    if (!isOpen) {
      setDuration(0);
      setCallStatus('Calling...');
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      return;
    }

    const t1 = setTimeout(() => {
      setCallStatus('Ringing...');
    }, 1800);

    const t2 = setTimeout(() => {
      setCallStatus('Connected');
    }, 4000);

    // If video call, attempt to request local camera preview
    if (type === 'video') {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          console.log('[Camera permission denied or camera not found - using placeholder UI]');
        });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, type]);

  // Duration timer once Connected
  useEffect(() => {
    if (callStatus !== 'Connected') return;
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    onClose();
  };

  if (!isOpen || !user) return null;

  return createPortal(
    <div
      className="fixed inset-0 w-screen h-screen bg-black/75 z-[9999] flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto transition-opacity"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div className="bg-[#111b21] w-full max-w-md rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center justify-between min-h-[480px] sm:min-h-[520px] my-auto relative text-white p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150 shrink-0">
        {/* Top Header Tag */}
        <div className="text-center pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs text-[#25d366] font-medium mb-3">
            {type === 'video' ? <Video size={13} /> : <Phone size={13} />}
            <span>WhatsApp {type === 'video' ? 'Video Call' : 'Voice Call'}</span>
          </div>
          <h3 className="text-2xl font-semibold tracking-wide text-white">{user.name}</h3>
          <p className="text-sm font-light mt-1 text-white/70">
            {callStatus === 'Connected' ? (
              <span className="text-[#25d366] font-mono tracking-wider">
                {formatDuration(duration)}
              </span>
            ) : (
              <span className="animate-pulse">{callStatus}</span>
            )}
          </p>
        </div>

        {/* Center Calling Avatar or Video Feed */}
        <div className="my-auto flex flex-col items-center justify-center relative w-full">
          {type === 'video' && cameraStream && isVideoEnabled ? (
            <div className="w-full h-64 rounded-2xl overflow-hidden bg-black/60 relative border border-white/15 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white/90 backdrop-blur-xs">
                You (Camera Preview)
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              {/* Pulse rings while calling */}
              {callStatus !== 'Connected' && (
                <>
                  <span className="absolute w-40 h-40 rounded-full bg-[#00a884]/20 animate-ping opacity-60" />
                  <span className="absolute w-48 h-48 rounded-full bg-[#00a884]/10 animate-pulse" />
                </>
              )}
              <div className="relative z-10 shadow-2xl rounded-full p-1 bg-white/10">
                <Avatar src={user.profilePic} name={user.name} size={110} />
              </div>
            </div>
          )}

          {callStatus === 'Connected' && (
            <div className="flex items-center gap-2 mt-4 text-xs text-white/60">
              <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
              <span>End-to-end encrypted</span>
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="w-full pt-4 flex items-center justify-center gap-5">
          {/* Mute button */}
          <button
            type="button"
            onClick={() => setIsMuted((p) => !p)}
            className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-red-500 text-white shadow-lg scale-105'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-xl transition-all cursor-pointer"
            title="End Call"
          >
            <PhoneOff size={28} />
          </button>

          {/* Speaker or Camera toggle */}
          {type === 'video' ? (
            <button
              type="button"
              onClick={() => setIsVideoEnabled((p) => !p)}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
                !isVideoEnabled
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSpeakerOn((p) => !p)}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
                !isSpeakerOn
                  ? 'bg-white/10 text-white/50'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
            >
              {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CallModal;
