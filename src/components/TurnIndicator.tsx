import type { GamePhase, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import Piece from './Piece';

interface TurnIndicatorProps {
  currentPlayer: PlayerId;
  phase: GamePhase;
  winner: PlayerId | null;
  player1Name?: string;
  player2Name?: string;
  isMyTurn?: boolean;
}

export default function TurnIndicator({ currentPlayer, phase, winner, player1Name, player2Name, isMyTurn }: TurnIndicatorProps) {
  const dummyPiece = { id: 'indicator', owner: currentPlayer, crowned: false, routePos: -1 };

  const getDisplayName = (player: PlayerId) => {
    const teamName = GAME_CONFIG.PLAYER_NAMES[player];
    const username = player === 1 ? player1Name : player2Name;
    if (username) return `${teamName} (${username})`;
    return teamName;
  };

  if (winner) {
    return (
      <div className="text-center py-1">
        <span className="font-heading text-xl text-highlight-selected">
          {getDisplayName(winner)} Wins!
        </span>
      </div>
    );
  }

  const phaseText = phase === 'rolling' ? 'Roll the dice'
    : phase === 'no_moves' ? 'No valid moves!'
    : 'Select a move';

  return (
    <div className="flex items-center justify-center gap-2 py-1 flex-wrap">
      <Piece piece={dummyPiece} size="sm" />
      <span className="font-heading text-base lg:text-lg text-white">
        {getDisplayName(currentPlayer)}
      </span>
      <span className="text-xs lg:text-sm text-white">
        — {phaseText}
      </span>
      {isMyTurn && phase !== 'game_over' && (
        <span className="text-amber-400 animate-pulse font-bold text-xs lg:text-sm shadow-[0_0_20px_rgba(255,180,0,0.5)]">Your Turn!</span>
      )}
    </div>
  );
}
