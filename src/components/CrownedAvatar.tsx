interface CrownedAvatarProps {
  avatarUrl: string | null;
  username: string;
  isChampion: boolean;
  size?: number; // px, default 32
  className?: string;
}

export default function CrownedAvatar({ avatarUrl, username, isChampion, size = 32, className = '' }: CrownedAvatarProps) {
  const sizeClass = `w-[${size}px] h-[${size}px]`;

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
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-lg drop-shadow-lg" style={{ fontSize: size * 0.55 }}>👑</span>
      )}
    </div>
  );
}
