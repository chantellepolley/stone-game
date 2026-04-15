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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 rounded-xl
                    bg-[#3d3632] border-2 border-[#5e5549] min-w-[120px] shadow-md">
      <div className="text-xs font-heading uppercase tracking-wider text-white/70">
        Jail
      </div>

      {/* Player 1 jail */}
      <div className="flex flex-col items-center gap-1">
        {jail[1].length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 max-w-[80px]">
            {jail[1].slice(0, 6).map(piece => (
              <Piece
                key={piece.id}
                piece={piece}
                size="sm"
                highlighted={currentPlayer === 1 && hasJailMoves}
                onClick={() => currentPlayer === 1 && hasJailMoves && onClickJailPiece(piece.id)}
              />
            ))}
            {jail[1].length > 6 && (
              <span className="text-[10px] text-player1">+{jail[1].length - 6}</span>
            )}
          </div>
        )}
        {jail[1].length > 0 && (
          <span className="text-[10px] text-player1">{jail[1].length} captured</span>
        )}
      </div>

      {/* Divider */}
      <div className="w-12 h-px bg-stone-accent/30" />

      {/* Player 2 jail */}
      <div className="flex flex-col items-center gap-1">
        {jail[2].length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 max-w-[80px]">
            {jail[2].slice(0, 6).map(piece => (
              <Piece
                key={piece.id}
                piece={piece}
                size="sm"
                highlighted={currentPlayer === 2 && hasJailMoves}
                onClick={() => currentPlayer === 2 && hasJailMoves && onClickJailPiece(piece.id)}
              />
            ))}
            {jail[2].length > 6 && (
              <span className="text-[10px] text-player2">+{jail[2].length - 6}</span>
            )}
          </div>
        )}
        {jail[2].length > 0 && (
          <span className="text-[10px] text-player2">{jail[2].length} captured</span>
        )}
      </div>

      {jail[1].length === 0 && jail[2].length === 0 && (
        <div className="text-[10px] text-stone-light/30 italic">Empty</div>
      )}
    </div>
  );
}
