import type { GameState, Move, AIDifficulty } from '../types/game';
import { getValidMoves, getMultiStepMoves, executeMove } from './moves';

/**
 * Score a move for the AI. Higher = better.
 */
function scoreMove(state: GameState, move: Move, difficulty: AIDifficulty): number {
  if (difficulty === 'easy') {
    return Math.random() * 100; // Random moves
  }

  let score = 0;

  // Bear off = huge priority (getting closer to winning)
  if (move.bearsOff) score += 1000;

  // Capture = very valuable
  if (move.captures) score += 500;

  // Crowning = good
  if (move.crowns) score += 100;

  // Prefer moving pieces that are further along (closer to home)
  if (move.from.type === 'board') {
    const piece = state.board[move.from.index].find(p => p.id === move.pieceId);
    if (piece) score += piece.routePos * 2;
  }

  // Enter from bench = get pieces in play
  if (move.from.type === 'bench') score += 50;

  // Prefer larger moves (use dice efficiently)
  score += move.diceValue * 3;

  // Hard mode: penalize leaving a lone piece exposed
  if (difficulty === 'hard' && move.to.type === 'board') {
    const newState = executeMove(state, move);
    const destPieces = newState.board[move.to.index].filter(p => p.owner === state.currentPlayer);
    // Lone piece on a space = vulnerable to capture
    if (destPieces.length === 1) score -= 80;
    // Stacking 2+ = safe
    if (destPieces.length >= 2) score += 40;
  }

  // Small random factor to avoid predictability
  score += Math.random() * 10;

  return score;
}

/**
 * Choose the best move for the AI from the available moves.
 */
export function chooseBestMove(state: GameState, validMoves: Move[], difficulty: AIDifficulty): Move | null {
  if (validMoves.length === 0) return null;

  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    const score = scoreMove(state, move, difficulty);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/**
 * Choose the best Joker doubles value for the AI.
 */
export function chooseBestJokerValue(state: GameState, difficulty: AIDifficulty): number {
  if (difficulty === 'easy') {
    return Math.floor(Math.random() * 6) + 1;
  }

  // Try each value 1-6, simulate having 4 of that value, and score the best available move
  let bestValue = 5;
  let bestScore = -Infinity;

  for (let v = 1; v <= 6; v++) {
    const simState: GameState = {
      ...state,
      dice: { ...state.dice, remaining: [v, v, v, v], pendingDoubleJoker: false },
    };

    const moves = [
      ...getValidMoves(simState, v),
      ...getMultiStepMoves(simState),
    ];

    if (moves.length === 0) continue;

    // Score the best move available with this value
    let moveScore = 0;
    for (const move of moves) {
      const s = scoreMove(simState, move, difficulty);
      if (s > moveScore) moveScore = s;
    }

    // Prefer higher values slightly (more flexibility)
    const totalScore = moveScore + v * 5 + Math.random() * 5;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestValue = v;
    }
  }

  return bestValue;
}
