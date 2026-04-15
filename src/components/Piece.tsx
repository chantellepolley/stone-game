import type { Piece as PieceType } from '../types/game';

interface PieceProps {
  piece: PieceType;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  highlighted?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export default function Piece({ piece, size = 'md', onClick, highlighted, className = '' }: PieceProps) {
  const isP1 = piece.owner === 1;

  const baseColor = isP1
    ? 'bg-player1 border-player1-accent'
    : 'bg-player2 border-player2-accent';

  const crownedStyle = piece.crowned
    ? 'ring-2 ring-highlight-selected shadow-[0_0_8px_rgba(255,152,0,0.6)]'
    : '';

  const highlightStyle = highlighted
    ? 'ring-3 ring-highlight-valid cursor-pointer hover:scale-115 pulse-valid brightness-120'
    : '';

  const clickable = onClick ? 'cursor-pointer hover:scale-105' : '';

  return (
    <div
      className={`
        ${sizeClasses[size]} rounded-full border-2
        ${baseColor} ${crownedStyle} ${highlightStyle} ${clickable}
        flex items-center justify-center
        transition-transform duration-150
        shadow-md piece-enter
        ${className}
      `}
      onClick={onClick}
      title={`${isP1 ? 'Sunstone' : 'Moonstone'}${piece.crowned ? ' (Crowned)' : ''}`}
    >
      {piece.crowned && (
        <span className="leading-none select-none" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '14px' : '18px' }}>
          {isP1 ? '☀' : '☽'}
        </span>
      )}
    </div>
  );
}
