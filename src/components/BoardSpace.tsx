import { useState } from 'react';
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
  isMobile: _isMobile = false,
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

  const crownedPieces = pieces.filter(p => p.crowned);
  const uncrownedPieces = pieces.filter(p => !p.crowned);
  const hasMixedTypes = crownedPieces.length > 0 && uncrownedPieces.length > 0;

  // When no mix, show as single stack
  const sorted = [...pieces].sort((a, b) => {
    if (a.crowned && !b.crowned) return -1;
    if (!a.crowned && b.crowned) return 1;
    return 0;
  });
  const maxVisible = 5;
  const visiblePieces = sorted.slice(-maxVisible);
  const hiddenCount = Math.max(0, sorted.length - maxVisible);

  const playerPieces = pieces.filter(p => p.owner === currentPlayer);
  const hasMixed = isSelected && playerPieces.length > 1 &&
    playerPieces.some(p => p.crowned) && playerPieces.some(p => !p.crowned);
  const [showPiecePopup, setShowPiecePopup] = useState(false);

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
      {/* Piece popup — zoomed view of all pieces on this space */}
      {showPiecePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => { e.stopPropagation(); setShowPiecePopup(false); }}>
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-4 shadow-2xl max-w-xs"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-white/50 text-[10px] font-heading uppercase tracking-wider text-center mb-2">
              {pieces.length} pieces on this space
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {pieces.map(piece => {
                const isThisPieceSelected = selectedPieceId === piece.id;
                const isPlayerPiece = piece.owner === currentPlayer;
                const canInteract = isValidSource || isValidTarget || (isSelected && isPlayerPiece);
                const showGlow = hintsEnabled && canInteract && !isThisPieceSelected;
                return (
                  <div key={piece.id} className="flex flex-col items-center gap-0.5">
                    <Piece
                      piece={piece}
                      size="lg"
                      highlighted={showGlow}
                      selected={isThisPieceSelected}
                      onClick={isPlayerPiece ? (e?: React.MouseEvent) => {
                        if (e) e.stopPropagation();
                        onClickPiece(piece.id);
                        setShowPiecePopup(false);
                      } : undefined}
                    />
                    <span className="text-[8px] text-white/40">
                      {piece.crowned ? 'Crowned' : 'Regular'}
                    </span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowPiecePopup(false)}
              className="w-full mt-3 px-4 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-white/10 text-white/70 hover:bg-white/20 cursor-pointer transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pieces stack */}
      {hasMixedTypes ? (
        /* Mixed crowned/uncrowned: show normal stack, auto-popup on click for piece selection */
        <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}
          onClick={(e) => { e.stopPropagation(); setShowPiecePopup(true); }}>
          {hiddenCount > 0 && (
            <div className="text-[10px] font-bold text-stone-bg bg-stone-light/60 rounded-full w-5 h-5 flex items-center justify-center mb-0.5">
              +{hiddenCount}
            </div>
          )}
          {visiblePieces.map((piece, i) => {
            const isThisPieceSelected = selectedPieceId === piece.id;
            const canInteract = isValidSource || isValidTarget || isSelected;
            const showGlow = hintsEnabled && canInteract && !isThisPieceSelected;
            return (
              <div key={piece.id} style={{ marginTop: i === 0 ? 0 : -6 }}>
                <Piece piece={piece} size="sm" highlighted={showGlow} selected={isThisPieceSelected} />
              </div>
            );
          })}
        </div>
      ) : (
        /* Single stack (all same type) */
        <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}>
          {hiddenCount > 0 && (
            <div className="text-[10px] font-bold text-stone-bg bg-stone-light/60 rounded-full w-5 h-5 flex items-center justify-center mb-0.5 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setShowPiecePopup(true); }}>
              +{hiddenCount}
            </div>
          )}
          {visiblePieces.map((piece, i) => {
            const isThisPieceSelected = selectedPieceId === piece.id;
            const isPlayerPiece = piece.owner === currentPlayer;
            const canInteract = isValidSource || isValidTarget || (isSelected && isPlayerPiece);
            const showGlow = hintsEnabled && canInteract && !isThisPieceSelected;
            const allowIndividual = hasMixed && isPlayerPiece;

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
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-accent/20 rounded-b-sm" />
    </div>
  );
}
