import { memo } from 'react';
import { useChat } from '../context/ChatContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';

const ChatLayout = memo(() => {
  const { selectedUser } = useChat();

  return (
    /*
     * Root shell:
     * - h-[100dvh] / w-[100dvw]  → fills the true visual viewport on mobile
     *   (accounts for collapsing address bars, virtual keyboards, and iOS
     *    Safe Area insets).
     * - overflow-hidden           → prevents any child from causing page-level
     *   scroll or rubber-band bounce on iOS Safari.
     */
    <div className="h-[100dvh] w-[100dvw] bg-[#eae6df] dark:bg-[#0c1317] flex items-center justify-center overflow-hidden relative select-none transition-colors">
      {/* WhatsApp green header band — desktop only */}
      <div className="hidden md:block w-full h-[127px] bg-[#00a884] dark:bg-[#00a884]/80 absolute top-0 left-0 z-0" />

      {/*
       * App container:
       * - On small screens      : full bleed, no rounding/border.
       * - On xl+ screens        : inset card with rounded corners.
       * - flex + overflow-hidden : guarantees children never escape bounds.
       */}
      <div className="relative z-10 w-full h-full xl:h-[calc(100dvh-38px)] xl:w-[calc(100vw-38px)] xl:max-w-[1600px] bg-white dark:bg-[#111b21] xl:rounded-md shadow-[0_6px_18px_rgba(11,20,26,0.12)] flex overflow-hidden border-0 xl:border border-[#e9edef] dark:border-[#222e35] transition-colors">

        {/*
         * Sidebar panel
         * Mobile  (< md): full-width when no chat active, hidden when a chat is open.
         * Desktop (≥ md): always visible at a fixed responsive width.
         */}
        <div
          className={`h-full flex-col shrink-0 ${
            selectedUser
              ? 'hidden md:flex md:w-[360px] lg:w-[400px] xl:w-[420px]'
              : 'flex w-full md:w-[360px] lg:w-[400px] xl:w-[420px]'
          }`}
        >
          <Sidebar />
        </div>

        {/*
         * Chat area panel
         * Mobile  (< md): full-width when a chat is active, hidden on the list screen.
         * Desktop (≥ md): flex-1 — fills remaining space beside the sidebar.
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
});

ChatLayout.displayName = 'ChatLayout';

export default ChatLayout;
