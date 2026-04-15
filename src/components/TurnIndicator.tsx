import type { GamePhase, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

interface TurnIndicatorProps {
  currentPlayer: PlayerId;
  phase: GamePhase;
  winner: PlayerId | null;
}

export default function TurnIndicator({ currentPlayer, phase, winner }: TurnIndicatorProps) {
  if (winner) {
    return (
      <div className="text-center py-2">
        <span className="font-heading text-xl text-highlight-selected">
          {GAME_CONFIG.PLAYER_NAMES[winner]} Wins!
        </span>
      </div>
    );
  }

  const name = GAME_CONFIG.PLAYER_NAMES[currentPlayer];
  const phaseText = phase === 'rolling' ? 'Roll the dice' : 'Select a move';

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className={`w-4 h-4 rounded-full ${currentPlayer === 1 ? 'bg-player1' : 'bg-player2'}`} />
      <span className="font-heading text-lg text-stone-light">
        {name}
      </span>
      <span className="text-sm text-stone-light/50">
        — {phaseText}
      </span>
    </div>
  );
}
