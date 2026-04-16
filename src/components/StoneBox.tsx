import type { Piece as PieceType, PlayerId } from '../types/game';
import Piece from './Piece';

interface StoneBoxProps {
  player: PlayerId;
  pieces: PieceType[];
  label: string;
  interactive?: boolean;
  hinting?: boolean;
  hintsEnabled?: boolean;
  currentPlayer?: PlayerId;
  onClick?: () => void;
  isSelected?: boolean;
  onDragStart?: (pieceId: string, e: React.PointerEvent) => void;
}

export default function StoneBox({ pieces, label, interactive, hinting, hintsEnabled = true, currentPlayer, onClick, isSelected, onDragStart }: StoneBoxProps) {
  const isP1Turn = (currentPlayer ?? 1) === 1;
  const ringColor = isP1Turn ? 'ring-amber-400' : 'ring-sky-400';
  const pulseClass = isP1Turn ? 'pulse-gold' : 'pulse-blue';

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`
        flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl
        border-2 min-w-[40px] w-[50px] sm:min-w-[60px] sm:w-[70px] lg:min-w-[80px] lg:w-[90px] h-full transition-all
        border-[#5e5549] bg-[#3d3632] shadow-md
        ${isSelected
          ? `ring-3 ${ringColor} brightness-125 ${pulseClass}`
          : interactive && hintsEnabled
          ? `ring-3 ${ringColor} cursor-pointer hover:brightness-120 ${pulseClass}`
          : interactive && !hintsEnabled
          ? 'cursor-pointer'
          : hinting && hintsEnabled
          ? `ring-2 ${ringColor}/60 ${pulseClass}`
          : ''
        }
      `}
    >
      <div className="text-[8px] font-heading uppercase tracking-wider text-white/70 leading-tight text-center">
        {label}
      </div>

      {/* Stacked pieces */}
      <div className="flex flex-wrap justify-center gap-0.5 max-w-[76px]">
        {pieces.slice(0, 4).map(piece => (
          <div
            key={piece.id}
            onPointerDown={interactive && onDragStart ? (e) => {
              e.stopPropagation();
              onDragStart(piece.id, e);
            } : undefined}
          >
            <Piece
              piece={piece}
              size="sm"
              highlighted={interactive}
              onClick={interactive ? onClick : undefined}
            />
          </div>
        ))}
      </div>

      {pieces.length > 4 && (
        <span className="text-[10px] text-white/70">
          +{pieces.length - 4}
        </span>
      )}

      {pieces.length > 0 && (
        <div className="text-[10px] font-bold text-white">
          {pieces.length}
        </div>
      )}

      {pieces.length === 0 && (
        <div className="text-[9px] text-white/30 italic">—</div>
      )}
    </div>
  );
}
