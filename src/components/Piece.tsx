import type { Piece as PieceType } from '../types/game';

interface PieceProps {
  piece: PieceType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  highlighted?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-6 h-6', px: 24, icon: 16 },
  md: { box: 'w-8 h-8', px: 32, icon: 22 },
  lg: { box: 'w-10 h-10', px: 40, icon: 28 },
};

/** Jester/trickster mask SVG for crowned pieces */
function JesterIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M6 15 L10 5 L14 11 L16 3 L18 11 L22 5 L26 15"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="4.5" r="1.8" fill={color} opacity="0.8" />
      <circle cx="16" cy="2.5" r="1.8" fill={color} opacity="0.8" />
      <circle cx="22" cy="4.5" r="1.8" fill={color} opacity="0.8" />
      <circle cx="16" cy="21" r="8" fill="rgba(255,255,255,0.15)" stroke={color} strokeWidth="1.2" />
      <path d="M12 19 L13 17.5 L14 19 L13 20.5 Z" fill={color} />
      <path d="M18 19 L19 17.5 L20 19 L19 20.5 Z" fill={color} />
      <path d="M11 23.5 Q16 28 21 23.5" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <line x1="14" y1="24.5" x2="14" y2="25.8" stroke={color} strokeWidth="0.7" />
      <line x1="16" y1="25" x2="16" y2="26.3" stroke={color} strokeWidth="0.7" />
      <line x1="18" y1="24.5" x2="18" y2="25.8" stroke={color} strokeWidth="0.7" />
    </svg>
  );
}

export default function Piece({ piece, size = 'md', onClick, highlighted, className = '' }: PieceProps) {
  const isP1 = piece.owner === 1;
  const s = sizes[size];

  // Player-colored border and tint overlay
  const borderColor = 'border-transparent';

  // Color overlay for player differentiation on top of stone texture
  const tintOverlay = piece.crowned
    ? isP1
      ? 'rgba(120, 60, 0, 0.55)'   // dark amber tint
      : 'rgba(30, 30, 100, 0.55)'   // dark indigo tint
    : isP1
      ? 'rgba(160, 100, 40, 0.45)'  // warm orange/sandstone tint
      : 'rgba(50, 80, 110, 0.45)';  // cool blue/slate tint

  const crownedStyle = piece.crowned
    ? 'ring-2 ring-amber-400/70 shadow-[0_0_10px_rgba(255,180,0,0.5)]'
    : '';

  const highlightStyle = highlighted
    ? 'ring-3 ring-highlight-valid cursor-pointer hover:scale-115 pulse-valid brightness-120'
    : '';

  const clickable = onClick ? 'cursor-pointer hover:scale-105' : '';

  const jesterColor = isP1 ? '#fbbf24' : '#93c5fd';

  return (
    <div
      className={`
        ${s.box} rounded-full border-2 relative overflow-hidden
        ${borderColor} ${crownedStyle} ${highlightStyle} ${clickable}
        flex items-center justify-center
        transition-transform duration-150
        shadow-md piece-enter
        ${className}
      `}
      onClick={onClick}
      title={`${isP1 ? 'Sunstone' : 'Moonstone'}${piece.crowned ? ' (Crowned - Jester)' : ''}`}
      style={{
        backgroundImage: `url('/stone-bg.jpg')`,
        backgroundSize: '200px',
        backgroundPosition: `${isP1 ? '0' : '50'}% ${isP1 ? '30' : '70'}%`,
      }}
    >
      {/* Color tint overlay */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: tintOverlay }}
      />

      {/* Subtle inner shadow for 3D carved look */}
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(255,255,255,0.1)' }}
      />

      {/* Crowned jester icon */}
      {piece.crowned && (
        <div className="relative z-10">
          <JesterIcon size={s.icon} color={jesterColor} />
        </div>
      )}
    </div>
  );
}
