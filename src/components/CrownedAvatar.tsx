interface CrownedAvatarProps {
  avatarUrl: string | null;
  username: string;
  isChampion: boolean;
  size?: number; // px, default 32
  className?: string;
}

export default function CrownedAvatar({ avatarUrl, username, isChampion, size = 32, className = '' }: CrownedAvatarProps) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="rounded-full object-cover border border-[#6b5f55]" style={{ width: size, height: size }} />
      ) : (
        <div className="rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]" style={{ width: size, height: size }}>
          <span className="font-heading text-white/40" style={{ fontSize: size * 0.35 }}>{username[0]?.toUpperCase()}</span>
        </div>
      )}
      {isChampion && (
        <svg
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: -(size * 0.28), width: size * 0.75, height: size * 0.5, transform: `translateX(-50%) rotate(15deg)` }}
          viewBox="0 0 40 28"
          fill="none"
        >
          {/* Crown body */}
          <path
            d="M3 22L8 8L15 16L20 4L25 16L32 8L37 22H3Z"
            fill="url(#crownGold)"
            stroke="#8B6914"
            strokeWidth="1.5"
          />
          {/* Crown base band */}
          <rect x="3" y="21" width="34" height="5" rx="1.5" fill="url(#crownBand)" stroke="#8B6914" strokeWidth="1" />
          {/* Jewels */}
          <circle cx="20" cy="24" r="1.8" fill="#E03030" stroke="#8B1A1A" strokeWidth="0.5" />
          <circle cx="12" cy="24" r="1.3" fill="#2080E0" stroke="#144080" strokeWidth="0.5" />
          <circle cx="28" cy="24" r="1.3" fill="#2080E0" stroke="#144080" strokeWidth="0.5" />
          {/* Top jewels on points */}
          <circle cx="20" cy="5" r="1.5" fill="#E03030" stroke="#8B1A1A" strokeWidth="0.5" />
          <circle cx="8" cy="9" r="1.2" fill="#20C060" stroke="#106030" strokeWidth="0.5" />
          <circle cx="32" cy="9" r="1.2" fill="#20C060" stroke="#106030" strokeWidth="0.5" />
          <defs>
            <linearGradient id="crownGold" x1="20" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD700" />
              <stop offset="0.5" stopColor="#DAA520" />
              <stop offset="1" stopColor="#B8860B" />
            </linearGradient>
            <linearGradient id="crownBand" x1="20" y1="21" x2="20" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#DAA520" />
              <stop offset="1" stopColor="#8B6914" />
            </linearGradient>
          </defs>
        </svg>
      )}
    </div>
  );
}
