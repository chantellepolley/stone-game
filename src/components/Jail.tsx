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

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 lg:py-3 rounded-xl
                    bg-[#3d3632] border-2 border-[#5e5549] min-w-[80px] lg:min-w-[100px] max-w-[200px] shadow-md">
      <div className="text-[9px] lg:text-xs font-heading uppercase tracking-wider text-white/70">
        Stoned Dungeon
      </div>

      {/* Player 1 jail */}
      <div className="flex flex-col items-center gap-0.5">
        {jail[1].length > 0 && (
          <div className="flex flex-wrap justify-center gap-0.5 max-w-[70px] lg:max-w-[80px]">
            {jail[1].slice(0, 4).map(piece => (
              <Piece
                key={piece.id}
                piece={piece}
                size="sm"
                highlighted={currentPlayer === 1 && hasJailMoves}
                onClick={() => currentPlayer === 1 && hasJailMoves && onClickJailPiece(piece.id)}
              />
            ))}
            {jail[1].length > 4 && (
              <span className="text-[9px] text-player1">+{jail[1].length - 4}</span>
            )}
          </div>
        )}
        {jail[1].length > 0 && (
          <span className="text-[9px] text-player1">{jail[1].length} jailed</span>
        )}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-stone-accent/30" />

      {/* Player 2 jail */}
      <div className="flex flex-col items-center gap-0.5">
        {jail[2].length > 0 && (
          <div className="flex flex-wrap justify-center gap-0.5 max-w-[70px] lg:max-w-[80px]">
            {jail[2].slice(0, 4).map(piece => (
              <Piece
                key={piece.id}
                piece={piece}
                size="sm"
                highlighted={currentPlayer === 2 && hasJailMoves}
                onClick={() => currentPlayer === 2 && hasJailMoves && onClickJailPiece(piece.id)}
              />
            ))}
            {jail[2].length > 4 && (
              <span className="text-[9px] text-player2">+{jail[2].length - 4}</span>
            )}
          </div>
        )}
        {jail[2].length > 0 && (
          <span className="text-[9px] text-player2">{jail[2].length} jailed</span>
        )}
      </div>

      {jail[1].length === 0 && jail[2].length === 0 && (
        <div className="text-[9px] text-stone-light/30 italic">Empty</div>
      )}
    </div>
  );
}
