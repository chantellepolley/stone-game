import type { Piece as PieceType, PlayerId, Move } from '../types/game';
import Piece from './Piece';

interface JailProps {
  jail: Record<PlayerId, PieceType[]>;
  validMoves: Move[];
  onClickJailPiece: (pieceId: string) => void;
  currentPlayer: PlayerId;
}

export default function Jail({ jail, validMoves, onClickJailPiece, currentPlayer }: JailProps) {
  const hasJailMoves = validMoves.some(m => m.from.type === 'jail');

  const renderPlayerJail = (player: PlayerId) => {
    if (jail[player].length === 0) return null;
    const canAct = currentPlayer === player && hasJailMoves;
    const firstPieceId = jail[player][0]?.id;

    return (
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`flex flex-wrap justify-center gap-0.5 max-w-[70px] lg:max-w-[80px] ${canAct ? 'cursor-pointer' : ''}`}
          onClick={() => canAct && firstPieceId && onClickJailPiece(firstPieceId)}
        >
          {jail[player].slice(0, 4).map(piece => (
            <Piece
              key={piece.id}
              piece={piece}
              size="sm"
              highlighted={canAct}
              onClick={() => canAct && onClickJailPiece(piece.id)}
            />
          ))}
          {jail[player].length > 4 && (
            <span className={`text-[9px] ${player === 1 ? 'text-player1' : 'text-player2'}`}>+{jail[player].length - 4}</span>
          )}
        </div>
        {canAct ? (
          <button
            onClick={() => firstPieceId && onClickJailPiece(firstPieceId)}
            className="text-[10px] text-amber-400 font-heading animate-pulse cursor-pointer"
          >
            Tap to re-enter
          </button>
        ) : (
          <span className={`text-[9px] ${player === 1 ? 'text-player1' : 'text-player2'}`}>{jail[player].length} jailed</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-xl
                    bg-[#3d3632] border-2 border-[#5e5549] min-w-[80px] lg:min-w-[100px] max-w-[200px] shadow-md
                    max-h-[80px] lg:max-h-[100px] overflow-y-auto">
      <div className="text-[9px] lg:text-xs font-heading uppercase tracking-wider text-white/70">
        Stoned Dungeon
      </div>

      {renderPlayerJail(1)}

      {/* Divider */}
      <div className="w-8 h-px bg-stone-accent/30" />

      {renderPlayerJail(2)}

      {jail[1].length === 0 && jail[2].length === 0 && (
        <div className="text-[9px] text-stone-light/30 italic">Empty</div>
      )}
    </div>
  );
}
