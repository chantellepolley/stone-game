import type { Piece as PieceType, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import Piece from './Piece';

interface StoragePitProps {
  player: PlayerId;
  pieces: PieceType[];
}

export default function StoragePit({ player, pieces }: StoragePitProps) {
  const name = GAME_CONFIG.PLAYER_NAMES[player];
  const total = GAME_CONFIG.NUM_PIECES;

  return (
    <div className={`
      flex flex-col items-center gap-2 px-4 py-3 rounded-xl
      border-2 min-w-[90px]
      ${player === 1
        ? 'border-player1-accent/40 bg-player1-dark/20'
        : 'border-player2-accent/40 bg-player2-dark/20'
      }
    `}>
      <div className="text-[10px] font-heading uppercase tracking-wider text-stone-light/60">
        {name} Home
      </div>

      {/* Stacked borne-off pieces */}
      <div className="flex flex-wrap justify-center gap-0.5 max-w-[70px]">
        {pieces.slice(0, 8).map(piece => (
          <Piece key={piece.id} piece={piece} size="sm" />
        ))}
      </div>

      <div className={`text-sm font-bold ${player === 1 ? 'text-player1' : 'text-player2'}`}>
        {pieces.length} / {total}
      </div>
    </div>
  );
}
