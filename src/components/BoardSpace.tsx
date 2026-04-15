import type { Piece as PieceType, Move } from '../types/game';
import Piece from './Piece';

interface BoardSpaceProps {
  index: number;
  pieces: PieceType[];
  variant: 'light' | 'dark';
  isValidSource: boolean;
  isValidTarget: boolean;
  isSelected: boolean;
  onClickSpace: () => void;
  onClickPiece: (pieceId: string) => void;
  targetMoves?: Move[];
}

export default function BoardSpace({
  index,
  pieces,
  variant,
  isValidSource,
  isValidTarget,
  isSelected,
  onClickSpace,
  onClickPiece,
}: BoardSpaceProps) {
  const bgColor = variant === 'light'
    ? 'bg-stone-light/80'
    : 'bg-stone-dark/80';

  const borderHighlight = isSelected
    ? 'ring-3 ring-highlight-selected shadow-[0_0_20px_rgba(255,152,0,0.7)] brightness-125'
    : isValidTarget
    ? 'ring-3 ring-highlight-valid shadow-[0_0_16px_rgba(76,175,80,0.7)] cursor-pointer pulse-valid brightness-115'
    : isValidSource
    ? 'ring-2 ring-highlight-valid shadow-[0_0_10px_rgba(76,175,80,0.5)] pulse-valid cursor-pointer brightness-110'
    : '';

  // Show max 4 pieces visually, then a count badge
  const maxVisible = 4;
  const visiblePieces = pieces.slice(-maxVisible);
  const hiddenCount = Math.max(0, pieces.length - maxVisible);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-end overflow-hidden
        ${bgColor} ${borderHighlight}
        rounded-t-lg rounded-b-sm
        h-[140px] w-full
        border border-stone-accent/40
        transition-all duration-200
        hover:brightness-110
      `}
      onClick={onClickSpace}
      style={{
        background: variant === 'light'
          ? 'linear-gradient(180deg, #d4c4a8 0%, #b8a88c 100%)'
          : 'linear-gradient(180deg, #9b8565 0%, #7a6545 100%)',
      }}
    >
      {/* Space index label */}
      <div className="absolute top-1 text-[9px] font-mono opacity-40 select-none">
        {index}
      </div>

      {/* Pieces stack — overlapping to fit fixed height */}
      <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}>
        {hiddenCount > 0 && (
          <div className="text-[10px] font-bold text-stone-bg bg-stone-light/60 rounded-full w-5 h-5 flex items-center justify-center mb-0.5">
            +{hiddenCount}
          </div>
        )}
        {visiblePieces.map((piece, i) => (
          <div key={piece.id} style={{ marginTop: i === 0 ? 0 : -4 }}>
            <Piece
              piece={piece}
              size="sm"
              highlighted={isValidSource}
              onClick={isValidSource ? () => onClickPiece(piece.id) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Obelisk carved line details */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-accent/20 rounded-b-sm" />
    </div>
  );
}
