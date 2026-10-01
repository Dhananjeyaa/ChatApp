/**
 * Avatar component — renders profile pic or WhatsApp silhouette with online indicator.
 * Usage: <Avatar src={user.profilePic} name={user.name} size={40} online={true} />
 */
const SilhouetteSVG = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 212 212"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="106" cy="106" r="106" fill="#dfe5e7" />
    <path
      fill="#b2bec3"
      d="M106 74.7a28.4 28.4 0 1 1 0 56.8 28.4 28.4 0 0 1 0-56.8zm0 69.3c-31.4 0-56.9 14.3-56.9 32v5.7c15.7 11 34.7 17.5 56.9 17.5s41.2-6.5 56.9-17.5V176c0-17.7-25.5-32-56.9-32z"
    />
  </svg>
);

const Avatar = ({
  src,
  name = '',
  size = 40,
  className = '',
  online = false,
}) => {
  const px = `${size}px`;
  // Proportional dot indicator sizing (minimum 10px, scaled to avatar size)
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    // 1. Explicit overflow-visible wrapper to ensure indicator is never clipped
    <div
      className={`relative shrink-0 overflow-visible ${className}`}
      style={{ width: px, height: px }}
    >
      {/* 2. Inner circular container for the image/silhouette */}
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#dfe5e7] select-none">
        {src ? (
          <img
            src={src}
            alt={name || 'avatar'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              if (e.currentTarget.nextSibling) {
                e.currentTarget.nextSibling.style.display = 'flex';
              }
            }}
          />
        ) : null}

        {/* Fallback silhouette if image fails or is empty */}
        <div
          className="w-full h-full flex items-center justify-center bg-[#dfe5e7]"
          style={{ display: src ? 'none' : 'flex' }}
        >
          <SilhouetteSVG size={size} />
        </div>
      </div>

      {/* 3. Green online indicator dot perfectly positioned at bottom-right corner */}
      {online && (
        <span
          className="absolute bottom-0 right-0 transform translate-x-0.5 translate-y-0.5 z-10 bg-[#25D366] border-2 border-white rounded-full shadow-xs pointer-events-none"
          style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
          aria-label="Online"
        />
      )}
    </div>
  );
};

export default Avatar;
