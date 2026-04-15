import type { DiceState } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Rolls the dice according to the current configuration.
 *
 * Face 6 is the Joker.
 * - Joker + number X = doubles of X (4 moves).
 * - Double Jokers = must use a 1 and 2 first, then choose any doubles (4 moves).
 */
export function rollDice(): DiceState {
  const { faces, doublesGrant4Moves, jokerFace } = GAME_CONFIG.DICE;

  const d1 = Math.floor(Math.random() * faces) + 1;
  const d2 = Math.floor(Math.random() * faces) + 1;
  const values: [number, number] = [d1, d2];

  const d1IsJoker = d1 === jokerFace;
  const d2IsJoker = d2 === jokerFace;

  let remaining: number[];
  let pendingDoubleJoker = false;

  if (d1IsJoker && d2IsJoker) {
    // Double Jokers: must move a 1 and 2 first, then choose doubles
    remaining = [1, 2];
    pendingDoubleJoker = true;
  } else if (d1IsJoker) {
    remaining = [d2, d2, d2, d2];
  } else if (d2IsJoker) {
    remaining = [d1, d1, d1, d1];
  } else if (d1 === d2 && doublesGrant4Moves) {
    remaining = [d1, d1, d1, d1];
  } else {
    remaining = [d1, d2];
  }

  return { values, remaining, hasRolled: true, pendingDoubleJoker };
}

/** Returns true if the raw die value is a Joker */
export function isJoker(value: number): boolean {
  return value === GAME_CONFIG.DICE.jokerFace;
}
