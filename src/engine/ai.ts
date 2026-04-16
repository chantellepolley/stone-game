import type { GameState, Move, AIDifficulty, PlayerId } from '../types/game';
import { getValidMoves, getMultiStepMoves, executeMove } from './moves';
import { GAME_CONFIG } from '../config/gameConfig';

const ROUTE_LENGTH = GAME_CONFIG.ROUTE_LENGTH;

/** Count how many of the opponent's pieces could reach a given route position */
function countThreats(state: GameState, routePos: number, player: PlayerId): number {
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const opponentRoute = GAME_CONFIG.PLAYER_ROUTE[opponent];
  let threats = 0;

  // Check opponent pieces that could reach the board space at this routePos
  const targetSpace = GAME_CONFIG.PLAYER_ROUTE[player][routePos];

  for (let i = 0; i < GAME_CONFIG.NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner !== opponent || p.routePos < 0) continue;
      // Can this opponent piece reach targetSpace within 6 moves (max single die)?
      for (let d = 1; d <= 6; d++) {
        const destRoutePos = p.routePos + d;
        if (destRoutePos >= ROUTE_LENGTH) break;
        if (opponentRoute[destRoutePos] === targetSpace) {
          threats++;
          break;
        }
      }
    }
  }
  return threats;
}

/** Check if a board space has friendly pieces (safe stack) */
function friendlyCountAt(state: GameState, spaceIdx: number, player: PlayerId): number {
  return state.board[spaceIdx].filter(p => p.owner === player).length;
}

/**
 * Score a move for the AI. Higher = better.
 */
function scoreMove(state: GameState, move: Move, difficulty: AIDifficulty): number {
  if (difficulty === 'easy') {
    return Math.random() * 100;
  }

  const player = state.currentPlayer;
  let score = 0;

  // ── Bear off = top priority ──
  if (move.bearsOff) score += 2000;

  // ── Capture = very valuable ──
  if (move.captures) score += 600;

  // ── Crowning = good ──
  if (move.crowns) score += 150;

  // ── Enter from bench = get pieces in play ──
  if (move.from.type === 'bench') score += 80;

  // ── Prefer advancing pieces (use dice efficiently) ──
  score += move.diceValue * 2;

  // ── Destination safety (medium + hard) ──
  if (move.to.type === 'board') {
    const newState = executeMove(state, move);
    const destFriendly = friendlyCountAt(newState, move.to.index, player);

    // Landing with a friend = safe, big bonus
    if (destFriendly >= 2) score += 200;

    // Landing alone = risky
    if (destFriendly === 1) {
      score -= 100;

      // Hard mode: check actual threats
      if (difficulty === 'hard') {
        const piece = newState.board[move.to.index].find(p => p.id === move.pieceId);
        if (piece) {
          const threats = countThreats(newState, piece.routePos, player);
          score -= threats * 80; // More threats = much worse
        }
      }
    }

    // ── Hard mode: leaving the source empty when it had a stack ──
    if (difficulty === 'hard' && move.from.type === 'board') {
      const srcFriendlyBefore = friendlyCountAt(state, move.from.index, player);
      const srcFriendlyAfter = friendlyCountAt(newState, move.from.index, player);
      // Breaking a safe pair into two singles = bad
      if (srcFriendlyBefore === 2 && srcFriendlyAfter === 1) {
        score -= 60;
      }
    }
  }

  // ── Hard mode: prefer spreading entry across multiple pieces early game ──
  if (difficulty === 'hard' && move.from.type === 'bench') {
    // Count how many pieces are already on the board
    let piecesOnBoard = 0;
    for (let i = 0; i < GAME_CONFIG.NUM_SPACES; i++) {
      piecesOnBoard += state.board[i].filter(p => p.owner === player).length;
    }
    // Bonus for entering when few pieces are out
    if (piecesOnBoard < 4) score += 120;
  }

  // ── Hard mode: prefer moves that land on or near friendly pieces ──
  if (difficulty === 'hard' && move.to.type === 'board') {
    // Check adjacent spaces (within 1-3 route steps) for friendly pieces
    const piece = state.board[move.from.type === 'board' ? move.from.index : 0]?.find(p => p.id === move.pieceId);
    const destRoutePos = piece ? piece.routePos + move.diceValue : 0;
    for (let offset = 1; offset <= 3; offset++) {
      const nearbyPos = destRoutePos + offset;
      const nearbyPosBehind = destRoutePos - offset;
      if (nearbyPos < ROUTE_LENGTH) {
        const nearbySpace = GAME_CONFIG.PLAYER_ROUTE[player][nearbyPos];
        if (friendlyCountAt(state, nearbySpace, player) > 0) score += 20;
      }
      if (nearbyPosBehind >= 0) {
        const nearbySpace = GAME_CONFIG.PLAYER_ROUTE[player][nearbyPosBehind];
        if (friendlyCountAt(state, nearbySpace, player) > 0) score += 20;
      }
    }
  }

  // ── Medium: mild penalty for lone pieces, mild bonus for stacking ──
  if (difficulty === 'medium' && move.to.type === 'board') {
    const newState = executeMove(state, move);
    const destFriendly = friendlyCountAt(newState, move.to.index, player);
    if (destFriendly === 1) score -= 40;
    if (destFriendly >= 2) score += 60;
  }

  // ── Avoid moving the same piece repeatedly (diversify) ──
  if (move.from.type === 'board') {
    const piece = state.board[move.from.index].find(p => p.id === move.pieceId);
    if (piece && piece.routePos > 15 && !piece.crowned) {
      // Piece is far along but not crowned — others might need catching up
      score -= 30;
    }
  }

  // Small random factor
  score += Math.random() * 8;

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

    let moveScore = 0;
    for (const move of moves) {
      const s = scoreMove(simState, move, difficulty);
      if (s > moveScore) moveScore = s;
    }

    const totalScore = moveScore + v * 5 + Math.random() * 5;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestValue = v;
    }
  }

  return bestValue;
}
