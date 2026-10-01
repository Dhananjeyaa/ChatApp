import { useChat } from '../context/ChatContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const ChatLayout = () => {
  const { selectedUser } = useChat();

  return (
    <div className="h-screen h-[100dvh] w-screen bg-[#eae6df] flex items-center justify-center overflow-hidden relative select-none">
      {/* WhatsApp Signature Top Green Header Band (Desktop only) */}
      <div className="hidden md:block w-full h-[127px] bg-[#00a884] absolute top-0 left-0 z-0" />

      {/* Main WhatsApp App Container */}
      <div className="relative z-10 w-full h-full xl:h-[calc(100vh-38px)] xl:w-[calc(100vw-38px)] xl:max-w-[1600px] bg-white xl:rounded-md shadow-[0_6px_18px_rgba(11,20,26,0.12)] flex overflow-hidden border-0 xl:border border-[#e9edef]">
        {/*
          Sidebar:
          - Mobile (< 768px): 100% width when no chat is active, hidden when in active chat
          - Desktop (≥ 768px): always visible with sleek fixed responsive width
        */}
        <div
          className={`h-full flex-col shrink-0 ${
            selectedUser ? 'hidden md:flex' : 'flex w-full md:w-[360px] lg:w-[400px] xl:w-[420px]'
          }`}
        >
          <Sidebar />
        </div>

        {/*
          ChatArea:
          - Mobile (< 768px): 100% width when chat is selected, hidden when on chat list
          - Desktop (≥ 768px): always visible as flex-1
        */}
        <div
          className={`flex-1 h-full min-w-0 ${
            selectedUser ? 'flex flex-col w-full' : 'hidden md:flex md:flex-col'
          }`}
        >
          <ChatArea />
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
