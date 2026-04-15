import type { Piece as PieceType } from '../types/game';

interface PieceProps {
  piece: PieceType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  highlighted?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-11 h-11', px: 44, icon: 26 },
  md: { box: 'w-13 h-13', px: 52, icon: 32 },
  lg: { box: 'w-15 h-15', px: 60, icon: 38 },
};


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
        backgroundSize: '100px',
        backgroundPosition: `${isP1 ? '0' : '50'}% ${isP1 ? '30' : '70'}%`,
        boxShadow: '0 4px 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
        filter: 'brightness(1.3) contrast(1.1)',
        border: `2px solid ${isP1 ? 'rgba(160,120,70,0.5)' : 'rgba(80,120,160,0.5)'}`,
      }}
    >
      {/* Color tint overlay */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: tintOverlay }}
      />

      {/* Chiseled stone inner shadow */}
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.08), inset 0 0 12px rgba(0,0,0,0.2)' }}
      />

      {/* Crowned: jester face image replaces stone texture */}
      {piece.crowned && (
        <img
          src="/jester.png"
          alt="Crowned"
          className="absolute inset-0 w-full h-full rounded-full object-cover z-10"
        />
      )}
    </div>
  );
}
