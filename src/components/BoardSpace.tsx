import { useState } from 'react';
import { createPortal } from 'react-dom';
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

  const [showPiecePopup, setShowPiecePopup] = useState(false);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-end overflow-hidden
        ${borderHighlight}
        rounded-lg
        h-full w-full min-h-0
        transition-all duration-200
      `}
      onClick={onClickSpace}
      style={{
        boxShadow: variant === 'light'
          ? '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        border: '1px solid rgba(120,110,95,0.4)',
      }}
    >
      {/* Stone texture background — isolated so filter doesn't affect pieces */}
      <div className="absolute inset-0 rounded-lg" style={{
        backgroundImage: "url('/stone-bg.jpg')",
        backgroundSize: `${140 + (_index * 17) % 80}px`,
        backgroundPosition: `${(_index * 67 + 11) % 100}% ${(_index * 89 + 23) % 100}%`,
        filter: 'brightness(1.55) contrast(0.85) saturate(0.5)',
      }} />
      {/* Warm tint overlay */}
      <div className="absolute inset-0 rounded-lg" style={{
        background: variant === 'light'
          ? 'rgba(190,160,110,0.3)'
          : 'rgba(150,120,80,0.3)',
      }} />
      {/* Piece popup — rendered via portal to escape board's stacking context */}
      {showPiecePopup && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}
          onClick={(e) => { e.stopPropagation(); setShowPiecePopup(false); }}>
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-4 shadow-2xl max-w-xs"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-amber-400 text-xs font-heading uppercase tracking-wider text-center mb-1">
              Choose which stone to move
            </div>
            <div className="text-white/40 text-[9px] text-center mb-2">
              {pieces.length} stones on this space
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
            {isValidTarget && (
              <button onClick={(e) => { e.stopPropagation(); setShowPiecePopup(false); onClickSpace(); }}
                className="w-full mt-3 px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors shadow-lg">
                Move Here
              </button>
            )}
            <button onClick={() => setShowPiecePopup(false)}
              className="w-full mt-2 px-4 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-white/10 text-white/70 hover:bg-white/20 cursor-pointer transition-colors">
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Pieces stack */}
      {hasMixedTypes ? (
        /* Mixed crowned/uncrowned: show normal stack, popup only when selecting a piece to move */
        <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}
          onClick={(e) => {
            // Show popup when this space is a valid source (need to pick which piece)
            // OR when it's a valid target with lots of pieces (no room to click the space itself)
            if ((isValidSource && !isSelected && !isValidTarget) || (isValidTarget && pieces.length >= 4)) {
              e.stopPropagation();
              setShowPiecePopup(true);
            }
          }}>
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
        <div className="relative w-full flex flex-col items-center pb-1" style={{ marginTop: 'auto' }}
          onClick={(e) => {
            if (isValidTarget && pieces.length >= 4) {
              e.stopPropagation();
              setShowPiecePopup(true);
            }
          }}>
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

            return (
              <div
                key={piece.id}
                style={{ marginTop: i === 0 ? 0 : -6 }}
                onPointerDown={isPlayerPiece && onDragStart ? (e) => {
                  e.stopPropagation();
                  onDragStart(piece.id, e);
                } : undefined}
              >
                <Piece
                  piece={piece}
                  size="sm"
                  highlighted={showGlow}
                  selected={isThisPieceSelected}
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
