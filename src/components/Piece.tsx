import type { Piece as PieceType } from '../types/game';

interface PieceProps {
  piece: PieceType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  highlighted?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-9 h-9', px: 36, icon: 22 },
  md: { box: 'w-11 h-11', px: 44, icon: 28 },
  lg: { box: 'w-13 h-13', px: 52, icon: 34 },
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
  // Lighter color overlay for player differentiation
  const tintOverlay = piece.crowned
    ? isP1
      ? 'rgba(180, 120, 40, 0.35)'  // warm amber tint
      : 'rgba(60, 80, 140, 0.35)'   // cool indigo tint
    : isP1
      ? 'rgba(200, 140, 60, 0.25)'  // light warm sandstone tint
      : 'rgba(70, 110, 150, 0.25)'; // light cool slate tint

  const crownedStyle = piece.crowned
    ? 'ring-2 ring-amber-400/70 shadow-[0_0_10px_rgba(255,180,0,0.5)]'
    : '';

  const pulseClass = isP1 ? 'pulse-gold' : 'pulse-blue';
  const highlightRing = isP1 ? 'ring-amber-400' : 'ring-sky-400';
  const highlightStyle = highlighted
    ? `ring-3 ${highlightRing} cursor-pointer hover:scale-115 ${pulseClass} brightness-120`
    : '';

  const clickable = onClick ? 'cursor-pointer hover:scale-105' : '';

  const jesterColor = isP1 ? '#fbbf24' : '#93c5fd';

  return (
    <div
      className={`
        ${s.box} rounded-full relative overflow-hidden
        ${crownedStyle} ${highlightStyle} ${clickable}
        flex items-center justify-center
        transition-transform duration-150
        piece-enter
        ${className}
      `}
      onClick={onClick}
      title={`${isP1 ? 'Sunstone' : 'Moonstone'}${piece.crowned ? ' (Crowned - Jester)' : ''}`}
      style={{
        backgroundImage: `url('/stone-bg.jpg')`,
        backgroundSize: '200px',
        backgroundPosition: `${isP1 ? '0' : '50'}% ${isP1 ? '30' : '70'}%`,
        boxShadow: '0 3px 6px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)',
        filter: 'brightness(1.4)',
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
