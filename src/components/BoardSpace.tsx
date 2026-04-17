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
  hintsEnabled?: boolean;
  isMobile?: boolean;
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
  hintsEnabled = true,
  isMobile = false,
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
    ? `ring-2 lg:ring-3 ${ringColor} ${pulseClass} brightness-115 lg:brightness-125`
    : isValidTarget && hintsEnabled
    ? `ring-2 lg:ring-3 ${ringColor} cursor-pointer ${pulseClass} brightness-110 lg:brightness-115`
    : isValidTarget && !hintsEnabled
    ? 'cursor-pointer'
    : isValidSource && hintsEnabled
    ? `ring-1 lg:ring-2 ${ringColor}/60 ${pulseClass} cursor-pointer brightness-105 lg:brightness-110`
    : isValidSource && !hintsEnabled
    ? 'cursor-pointer'
    : '';

  // Sort: uncrowned pieces on top (visible), crowned hidden in +X
  const sorted = [...pieces].sort((a, b) => {
    if (a.crowned && !b.crowned) return -1; // crowned first (bottom of stack)
    if (!a.crowned && b.crowned) return 1;  // uncrowned last (top = visible)
    return 0;
  });
  const maxVisible = 5;
  const visiblePieces = sorted.slice(-maxVisible);
  const hiddenCount = Math.max(0, sorted.length - maxVisible);

  // Only spread pieces for selection when mixed crowned/uncrowned AND on desktop
  const playerPieces = pieces.filter(p => p.owner === currentPlayer);
  const hasMixed = !isMobile && isSelected && playerPieces.length > 1 &&
    playerPieces.some(p => p.crowned) && playerPieces.some(p => !p.crowned);

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
          const isPlayerPiece = piece.owner === currentPlayer;
          const canInteract = isValidSource || isValidTarget || (isSelected && isPlayerPiece);
          const showGlow = hintsEnabled && canInteract && !isThisPieceSelected;

          // Desktop only: individual piece click/drag for mixed crowned/uncrowned
          const allowIndividual = !isMobile && hasMixed && isPlayerPiece;

          return (
            <div
              key={piece.id}
              style={{ marginTop: i === 0 ? 0 : hasMixed ? 1 : -6 }}
              onPointerDown={allowIndividual && onDragStart ? (e) => {
                e.stopPropagation();
                onDragStart(piece.id, e);
              } : undefined}
            >
              <Piece
                piece={piece}
                size="sm"
                highlighted={showGlow}
                selected={isThisPieceSelected}
                onClick={allowIndividual ? (e?: React.MouseEvent) => {
                  if (e) e.stopPropagation();
                  onClickPiece(piece.id);
                } : undefined}
              />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-accent/20 rounded-b-sm" />
    </div>
  );
}
