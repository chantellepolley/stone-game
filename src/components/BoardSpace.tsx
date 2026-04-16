import type { Piece as PieceType, Move, PlayerId } from '../types/game';
import Piece from './Piece';

interface BoardSpaceProps {
  index: number;
  pieces: PieceType[];
  variant: 'light' | 'dark';
  isValidSource: boolean;
  isValidTarget: boolean;
  isSelected: boolean;
  selectedPieceId?: string | null;
  currentPlayer: PlayerId;
  onClickSpace: () => void;
  onClickPiece: (pieceId: string) => void;
  onDragStart?: (pieceId: string, e: React.PointerEvent) => void;
  targetMoves?: Move[];
}

export default function BoardSpace({
  index: _index,
  pieces,
  variant,
  isValidSource,
  isValidTarget,
  isSelected,
  selectedPieceId,
  currentPlayer,
  onClickSpace,
  onClickPiece,
  onDragStart,
}: BoardSpaceProps) {
  const bgColor = variant === 'light'
    ? 'bg-stone-light/80'
    : 'bg-stone-dark/80';

  const isP1 = currentPlayer === 1;
  const ringColor = isP1 ? 'ring-amber-400' : 'ring-sky-400';
  const pulseClass = isP1 ? 'pulse-gold' : 'pulse-blue';

  const borderHighlight = isSelected
    ? `ring-3 ${ringColor} ${pulseClass} brightness-125`
    : isValidTarget
    ? `ring-3 ${ringColor} cursor-pointer ${pulseClass} brightness-115`
    : isValidSource
    ? `ring-2 ${ringColor}/70 ${pulseClass} cursor-pointer brightness-110`
    : '';

  const maxVisible = 5;
  const visiblePieces = pieces.slice(-maxVisible);
  const hiddenCount = Math.max(0, pieces.length - maxVisible);

  // When selected, spread pieces out more so each is individually clickable
  const playerPieces = pieces.filter(p => p.owner === currentPlayer);
  const hasMultipleSelectable = isSelected && playerPieces.length > 1;

  return (
    <div
      className={`
        relative flex flex-col items-center justify-end overflow-hidden
        ${bgColor} ${borderHighlight}
        rounded-t-lg rounded-b-sm
        h-full w-full min-h-0
        border border-stone-accent/40
        transition-all duration-200
        hover:brightness-110
      `}
      onClick={onClickSpace}
      style={{
        background: variant === 'light'
          ? 'linear-gradient(180deg, #918578 0%, #7a6f64 100%)'
          : 'linear-gradient(180deg, #6b6058 0%, #57504a 100%)',
      }}
    >

      {/* Pieces stack */}
      <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}>
        {hiddenCount > 0 && (
          <div className="text-[10px] font-bold text-stone-bg bg-stone-light/60 rounded-full w-5 h-5 flex items-center justify-center mb-0.5">
            +{hiddenCount}
          </div>
        )}
        {visiblePieces.map((piece, i) => {
          const isThisPieceSelected = selectedPieceId === piece.id;
          const canSelect = isValidSource || (isSelected && piece.owner === currentPlayer);
          return (
            <div
              key={piece.id}
              style={{ marginTop: i === 0 ? 0 : hasMultipleSelectable ? 2 : -4 }}
              onPointerDown={canSelect && onDragStart ? (e) => {
                e.stopPropagation();
                onDragStart(piece.id, e);
              } : undefined}
            >
              <Piece
                piece={piece}
                size="sm"
                highlighted={canSelect}
                selected={isThisPieceSelected}
                onClick={canSelect ? (e?: React.MouseEvent) => {
                  if (e) e.stopPropagation();
                  onClickPiece(piece.id);
                } : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Obelisk carved line details */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-accent/20 rounded-b-sm" />
    </div>
  );
}
