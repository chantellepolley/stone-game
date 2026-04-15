import type { Piece as PieceType, PlayerId } from '../types/game';
import Piece from './Piece';

interface StoneBoxProps {
  player: PlayerId;
  pieces: PieceType[];
  label: string;
  interactive?: boolean;
  hinting?: boolean;
  currentPlayer?: PlayerId;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function StoneBox({ pieces, label, interactive, hinting, currentPlayer, onClick, isSelected }: StoneBoxProps) {
  const isP1Turn = (currentPlayer ?? 1) === 1;
  const ringColor = isP1Turn ? 'ring-amber-400' : 'ring-sky-400';
  const pulseClass = isP1Turn ? 'pulse-gold' : 'pulse-blue';

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`
        flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl
        border-2 min-w-[60px] w-[68px] transition-all
        border-[#555] bg-[#3a3a3a] shadow-md
        ${isSelected
          ? `ring-3 ${ringColor} brightness-125 ${pulseClass}`
          : interactive
          ? `ring-3 ${ringColor} cursor-pointer hover:brightness-120 ${pulseClass}`
          : hinting
          ? `ring-2 ${ringColor}/60 ${pulseClass}`
          : ''
        }
      `}
    >
      <div className="text-[8px] font-heading uppercase tracking-wider text-white/70 leading-tight text-center">
        {label}
      </div>

      {/* Stacked pieces */}
      <div className="flex flex-wrap justify-center gap-0.5 max-w-[50px]">
        {pieces.slice(0, 6).map(piece => (
          <Piece key={piece.id} piece={piece} size="sm" />
        ))}
      </div>

      {pieces.length > 6 && (
        <span className="text-[10px] text-white/70">
          +{pieces.length - 6}
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
