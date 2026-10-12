import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

/**
 * 3-Way Message Deletion Modal
 * Option 1: "Delete for Me" -> Hides only for current user
 * Option 2: "Delete for Everyone" -> Deletes for both sides in real time (available if user is sender)
 * Option 3: "Cancel" -> Closes modal
 */
const DeleteMessageModal = ({
  isOpen,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  isMine,
  isDeleting,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Delete message options"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={!isDeleting ? onClose : undefined}
      />

      {/* Card modal */}
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111b21] rounded-t-2xl sm:rounded-2xl shadow-2xl px-6 pt-6 pb-8 sm:pb-6 z-10 animate-[slideUp_200ms_ease-out] border border-transparent dark:border-[#222e35]">
        {/* Header Icon */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400">
            <Trash2 size={22} />
          </div>
        </div>

        <h3 className="text-center text-base font-semibold text-[#111b21] dark:text-[#e9edef] mb-1">
          Delete message?
        </h3>
        <p className="text-center text-xs text-[#667781] dark:text-[#8696a0] mb-6">
          Choose how you want to delete this message.
        </p>

        {/* Action Options */}
        <div className="flex flex-col gap-2.5">
          {/* Option 2: Delete for Everyone (if sender) */}
          {isMine && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={onDeleteForEveryone}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-medium transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {isDeleting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Delete for everyone'
              )}
            </button>
          )}

          {/* Option 1: Delete for Me */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDeleteForMe}
            className="w-full py-2.5 px-4 rounded-xl border border-[#e9edef] dark:border-[#222e35] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            Delete for me
          </button>

          {/* Option 3: Cancel */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-white hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteMessageModal;
