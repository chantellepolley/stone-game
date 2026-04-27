import type { Piece as PieceType } from '../types/game';
import { getStoneColor, loadPlayerColor } from '../utils/stoneColors';
import { useStoneColorOverrides } from '../contexts/StoneColorContext';

interface PieceProps {
  piece: PieceType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e?: React.MouseEvent) => void;
  highlighted?: boolean;
  selected?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'w-7 h-7 sm:w-9 sm:h-9 lg:w-11 lg:h-11', px: 44, icon: 26 },
  md: { box: 'w-9 h-9 sm:w-11 sm:h-11 lg:w-13 lg:h-13', px: 52, icon: 32 },
  lg: { box: 'w-11 h-11 sm:w-13 sm:h-13 lg:w-15 lg:h-15', px: 60, icon: 38 },
};

// Default opponent color
const DEFAULT_P2_COLOR = 'slate';

export default function Piece({ piece, size = 'md', onClick, highlighted, selected, className = '' }: PieceProps) {
  const isP1 = piece.owner === 1;
  const s = sizes[size];
  const colorOverrides = useStoneColorOverrides();

  // Get custom color — context overrides take priority (used in online games for color conflict resolution)
  const colorId = isP1
    ? (colorOverrides.p1ColorId || loadPlayerColor())
    : (colorOverrides.p2ColorId || DEFAULT_P2_COLOR);
  const color = getStoneColor(colorId);
  const borderOverride = isP1 ? colorOverrides.p1BorderOverride : colorOverrides.p2BorderOverride;

  const tintOverlay = piece.crowned ? color.tintCrowned : color.tint;

  const crownedStyle = piece.crowned
    ? 'ring-2 ring-amber-400/70 shadow-[0_0_10px_rgba(255,180,0,0.5)]'
    : '';

  const selectedStyle = selected
    ? 'ring-4 ring-white shadow-[0_0_16px_rgba(255,255,255,0.6)] scale-110 z-10'
    : '';
  const highlightStyle = !selected && highlighted
    ? `ring-3 ${color.ring} cursor-pointer hover:scale-110 ${color.pulse} brightness-120`
    : '';

  const clickable = onClick ? 'cursor-pointer hover:scale-105' : '';

  return (
    <div
      className={`
        ${s.box} rounded-full relative overflow-hidden
        ${crownedStyle} ${selectedStyle} ${highlightStyle} ${clickable}
        flex items-center justify-center
        transition-transform duration-150
        piece-enter
        ${className}
      `}
      onClick={onClick}
      title={`${isP1 ? 'Sunstone' : 'Moonstone'}${piece.crowned ? ' (Crowned - Jester)' : ''}`}
      style={{
        backgroundImage: "url('/stone-bg.jpg')",
        backgroundSize: '100px',
        backgroundPosition: `${isP1 ? '0' : '50'}% ${isP1 ? '30' : '70'}%`,
        boxShadow: '0 4px 8px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
        filter: 'brightness(1.5) contrast(1.05)',
        border: `${borderOverride ? '3px' : '2px'} solid ${borderOverride || color.border}`,
      }}
    >
      {/* Color tint overlay */}
      <div className="absolute inset-0 rounded-full" style={
        (piece.crowned ? color.gradientCrowned : color.gradient)
          ? { background: piece.crowned ? color.gradientCrowned : color.gradient }
          : { backgroundColor: tintOverlay }
      } />

      {/* Chiseled stone inner shadow */}
      <div className="absolute inset-0 rounded-full"
        style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.08), inset 0 0 12px rgba(0,0,0,0.2)' }}
      />

      {/* Crowned: jester face */}
      {piece.crowned && (
        <img src="/jester.png" alt="Crowned"
          className="absolute inset-0 w-full h-full rounded-full object-cover z-10" />
      )}
    </div>
  );
}
