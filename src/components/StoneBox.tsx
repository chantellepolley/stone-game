import type { Piece as PieceType, PlayerId } from '../types/game';
import Piece from './Piece';

interface StoneBoxProps {
  player: PlayerId;
  pieces: PieceType[];
  label: string;
  /** Interactive: can be clicked to select (bench) or bear off (home) */
  interactive?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function StoneBox({ player, pieces, label, interactive, onClick, isSelected }: StoneBoxProps) {
  const isP1 = player === 1;

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`
        flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl
        border-2 min-w-[60px] w-[68px] transition-all
        ${isP1
          ? 'border-player1-accent/40 bg-player1-dark/20'
          : 'border-player2-accent/40 bg-player2-dark/20'
        }
        ${isSelected
          ? 'ring-2 ring-highlight-selected shadow-[0_0_12px_rgba(255,152,0,0.5)]'
          : interactive
          ? 'ring-1 ring-highlight-valid/50 cursor-pointer hover:brightness-110 pulse-valid'
          : ''
        }
      `}
    >
      <div className="text-[8px] font-heading uppercase tracking-wider text-stone-light/50 leading-tight text-center">
        {label}
      </div>

      {/* Stacked pieces */}
      <div className="flex flex-wrap justify-center gap-0.5 max-w-[50px]">
        {pieces.slice(0, 6).map(piece => (
          <Piece key={piece.id} piece={piece} size="sm" />
        ))}
      </div>

      {pieces.length > 6 && (
        <span className={`text-[10px] ${isP1 ? 'text-player1/70' : 'text-player2/70'}`}>
          +{pieces.length - 6}
        </span>
      )}

      {pieces.length > 0 && (
        <div className={`text-[10px] font-bold ${isP1 ? 'text-player1' : 'text-player2'}`}>
          {pieces.length}
        </div>
      )}

      {pieces.length === 0 && (
        <div className="text-[9px] text-stone-light/25 italic">—</div>
      )}
    </div>
  );
}
