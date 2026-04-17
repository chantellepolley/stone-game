import type { GameState, Piece, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

function createPieces(player: PlayerId): Piece[] {
  return Array.from({ length: GAME_CONFIG.NUM_PIECES }, (_, i) => ({
    id: `p${player}-${i}`,
    owner: player,
    crowned: false,
    routePos: -1,
  }));
}

/**
 * Creates a fresh game state. All pieces start in each player's bench (starting area).
 */
export function createInitialState(): GameState {
  const board: Piece[][] = Array.from({ length: GAME_CONFIG.NUM_SPACES }, () => []);

  return {
    board,
    bench: { 1: createPieces(1), 2: createPieces(2) },
    jail: { 1: [], 2: [] },
    home: { 1: [], 2: [] },
    currentPlayer: 1,
    dice: { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJester: false },
    phase: 'not_started',
    gameMode: 'pvp',
    aiDifficulty: 'medium',
    winner: null,
    moveLog: [],
    turnCount: 1,
    captureCount: { 1: 0, 2: 0 },
  };
}
