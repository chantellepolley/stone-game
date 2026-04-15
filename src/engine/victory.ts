import type { GameState, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Returns the winning player if one has borne off all pieces, or null.
 */
export function checkWinCondition(state: GameState): PlayerId | null {
  if (state.home[1].length >= GAME_CONFIG.NUM_PIECES) return 1;
  if (state.home[2].length >= GAME_CONFIG.NUM_PIECES) return 2;
  return null;
}
