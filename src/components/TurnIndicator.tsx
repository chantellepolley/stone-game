import type { GamePhase, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import Piece from './Piece';

interface TurnIndicatorProps {
  currentPlayer: PlayerId;
  phase: GamePhase;
  winner: PlayerId | null;
}

export default function TurnIndicator({ currentPlayer, phase, winner }: TurnIndicatorProps) {
  const dummyPiece = { id: 'indicator', owner: currentPlayer, crowned: false, routePos: -1 };

  if (winner) {
    return (
      <div className="text-center py-1">
        <span className="font-heading text-xl text-highlight-selected">
          {GAME_CONFIG.PLAYER_NAMES[winner]} Wins!
        </span>
      </div>
    );
  }

  const name = GAME_CONFIG.PLAYER_NAMES[currentPlayer];
  const phaseText = phase === 'rolling' ? 'Roll the dice' : 'Select a move';

  return (
    <div className="flex items-center justify-center gap-3 py-1">
      <Piece piece={dummyPiece} size="sm" />
      <span className="font-heading text-lg text-white">
        {name}
      </span>
      <span className="text-sm text-white/50">
        — {phaseText}
      </span>
    </div>
  );
}
