/**
 * Ref-counted body scroll lock manager
 * Prevents scroll lock collisions when multiple modals open/close or overlap
 */
let lockCount = 0;

export const lockBodyScroll = () => {
  lockCount += 1;
  if (lockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
};

export const unlockBodyScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = '';
  }
};
