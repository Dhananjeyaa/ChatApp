import React, { memo } from 'react';
import { Star, CheckCheck, Trash2, Ban } from 'lucide-react';

const formatTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * High-performance memoized Message Item
 * Prevents re-rendering existing message bubbles during input typing or unrelated state changes
 */
const MessageItem = memo(
  ({
    msg,
    isMine,
    isStarred,
    showBadge,
    dateBadge,
    isFirstInGroup,
    isMatch,
    isGroup,
    chatSearchQuery,
    onToggleStar,
    onRequestDelete,
    VoicePlayerComponent,
    measureRef,
  }) => {
    const msgDate = msg.createdAt || msg.timestamp;
    const isMsgDeleted = Boolean(msg.isDeleted);

    // Search query highlighter
    const renderMessageContent = (messageText) => {
      if (!chatSearchQuery || !chatSearchQuery.trim()) return messageText;
      const query = chatSearchQuery.trim();
      const parts = (messageText || '').split(new RegExp(`(${query})`, 'gi'));
      return parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={index}
            className="bg-[#ffeaa7] dark:bg-amber-400 dark:text-[#111b21] text-[#111b21] font-semibold px-0.5 rounded shadow-xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    };

    return (
      <div ref={measureRef} className="relative z-10">
        {/* Date Badge */}
        {showBadge && (
          <div className="flex justify-center my-3 select-none sticky top-1 z-10">
            <span className="bg-white/95 dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] uppercase tracking-wider border border-transparent dark:border-[#222e35]">
              {dateBadge}
            </span>
          </div>
        )}

        {/* Message Bubble Container */}
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
            {isGroup && !isMine && isFirstInGroup && (
              <span className="text-[11px] font-semibold text-[#00a884] block mb-0.5">
                {msg.sender?.name || 'Participant'}
              </span>
            )}

            {/* Message Body */}
            {isMsgDeleted ? (
              <div className="flex items-center gap-1.5 py-0.5 text-[#667781] dark:text-[#8696a0] italic select-none">
                <Ban size={14} className="text-[#8696a0] shrink-0" />
                <span>This message was deleted</span>
              </div>
            ) : msg.messageType === 'audio' && VoicePlayerComponent ? (
              <VoicePlayerComponent
                mediaUrl={msg.mediaUrl}
                duration={msg.mediaDuration}
                isMine={isMine}
              />
            ) : msg.messageType === 'image' && msg.mediaUrl ? (
              <div className="flex flex-col gap-1">
                <img
                  src={msg.mediaUrl}
                  alt={msg.message || 'Image attachment'}
                  className="max-h-60 rounded-md object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(msg.mediaUrl, '_blank')}
                />
                {msg.message && (
                  <span className="text-[#111b21] dark:text-[#e9edef] leading-relaxed whitespace-pre-wrap select-text mt-1">
                    {renderMessageContent(msg.message)}
                  </span>
                )}
              </div>
            ) : msg.messageType === 'file' && msg.mediaUrl ? (
              <div className="flex flex-col gap-1">
                <a
                  href={msg.mediaUrl}
                  download={msg.message || 'attachment'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/10 rounded-md hover:bg-black/10 dark:hover:bg-white/15 transition-colors text-xs font-medium text-[#111b21] dark:text-[#e9edef]"
                >
                  <span className="text-base">📄</span>
                  <span className="truncate">{msg.message || 'Download file'}</span>
                </a>
              </div>
            ) : (
              <span className="text-[#111b21] dark:text-[#e9edef] leading-relaxed whitespace-pre-wrap select-text">
                {renderMessageContent(msg.message)}
              </span>
            )}

            {/* Metadata Footer: Timestamp + Status + Star + Delete */}
            <div className="inline-flex items-center gap-1 float-right ml-3 mt-1 select-none shrink-0">
              {!isMsgDeleted && isStarred && (
                <Star size={11} className="fill-[#8696a0] text-[#8696a0] shrink-0" />
              )}

              <span className="text-[10px] text-[#667781] dark:text-[#8696a0] leading-none">
                {formatTime(msgDate)}
              </span>

              {isMine && !isMsgDeleted && (
                <CheckCheck
                  size={15}
                  className={msg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'}
                />
              )}

              {/* Quick Star / Bookmark on Hover */}
              {!isMsgDeleted && (
                <button
                  type="button"
                  onClick={() => onToggleStar(msg._id)}
                  title={isStarred ? 'Unstar message' : 'Star message'}
                  className="opacity-0 group-hover/bubble:opacity-100 hover:text-[#00a884] text-[#8696a0] transition-opacity ml-1 cursor-pointer"
                >
                  <Star size={12} className={isStarred ? 'fill-[#00a884] text-[#00a884]' : ''} />
                </button>
              )}

              {/* Quick Delete Option on Hover */}
              {onRequestDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(msg)}
                  title="Delete message"
                  className="opacity-0 group-hover/bubble:opacity-100 hover:text-red-500 text-[#8696a0] transition-opacity ml-0.5 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.msg._id === next.msg._id &&
      prev.msg.status === next.msg.status &&
      prev.msg.message === next.msg.message &&
      prev.msg.isDeleted === next.msg.isDeleted &&
      prev.isStarred === next.isStarred &&
      prev.isMatch === next.isMatch &&
      prev.showBadge === next.showBadge &&
      prev.isFirstInGroup === next.isFirstInGroup &&
      prev.chatSearchQuery === next.chatSearchQuery
    );
  }
);

MessageItem.displayName = 'MessageItem';

export default MessageItem;
