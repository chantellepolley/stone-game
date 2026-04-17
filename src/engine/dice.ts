import type { DiceState } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Rolls the dice according to the current configuration.
 *
 * Face 6 is the Jester.
 * - Jester + number X = doubles of X (4 moves).
 * - Double Jesters = must use a 1 and 2 first, then choose any doubles (4 moves).
 */
export function rollDice(): DiceState {
  const { faces, doublesGrant4Moves, jesterFace } = GAME_CONFIG.DICE;

  const d1 = Math.floor(Math.random() * faces) + 1;
  const d2 = Math.floor(Math.random() * faces) + 1;
  const values: [number, number] = [d1, d2];

  const d1IsJester = d1 === jesterFace;
  const d2IsJester = d2 === jesterFace;

  let remaining: number[];
  let pendingDoubleJester = false;

  if (d1IsJester && d2IsJester) {
    // Double Jesters: must move a 1 and 2 first, then choose doubles
    remaining = [1, 2];
    pendingDoubleJester = true;
  } else if (d1IsJester) {
    remaining = [d2, d2, d2, d2];
  } else if (d2IsJester) {
    remaining = [d1, d1, d1, d1];
  } else if (d1 === d2 && doublesGrant4Moves) {
    remaining = [d1, d1, d1, d1];
  } else {
    remaining = [d1, d2];
  }

  return { values, remaining, hasRolled: true, pendingDoubleJester };
}

/** Returns true if the raw die value is a Jester */
export function isJester(value: number): boolean {
  return value === GAME_CONFIG.DICE.jesterFace;
}
