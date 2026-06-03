import type { GameState, Move, AIDifficulty, PlayerId } from '../types/game';
import { getValidMoves, getMultiStepMoves, executeMove } from './moves';
import { GAME_CONFIG } from '../config/gameConfig';

const ROUTE_LENGTH = GAME_CONFIG.ROUTE_LENGTH;
const NUM_SPACES = GAME_CONFIG.NUM_SPACES;

// Dice probability: how many ways (out of 36) can you roll each total?
// Includes jester combos (jester+X = doubles of X, so any single value is reachable)
const DICE_COMBOS: Record<number, number> = {
  1: 11, // 6 ways from jester+1 doubles, 2 from (1,J)(J,1), plus combos
  2: 12, 3: 14, 4: 15, 5: 17, // most dangerous distance
  // Can't roll exactly 6 (jester replaces 6), but combined moves can reach further
  7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

/** Count weighted threat score based on dice probability */
function countThreatsWeighted(state: GameState, routePos: number, player: PlayerId): number {
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const opponentRoute = GAME_CONFIG.PLAYER_ROUTE[opponent];
  const targetSpace = GAME_CONFIG.PLAYER_ROUTE[player][routePos];
  let threatScore = 0;

  for (let i = 0; i < NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner !== opponent || p.routePos < 0) continue;
      for (let d = 1; d <= 12; d++) {
        const destRoutePos = p.routePos + d;
        if (destRoutePos >= ROUTE_LENGTH) break;
        if (opponentRoute[destRoutePos] === targetSpace) {
          // Weight by probability of rolling that distance
          threatScore += (DICE_COMBOS[d] || 0);
          break;
        }
      }
    }
  }
  return threatScore;
}

/** Simple threat count (non-weighted, for backward compat) */
function countThreats(state: GameState, routePos: number, player: PlayerId): number {
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const opponentRoute = GAME_CONFIG.PLAYER_ROUTE[opponent];
  const targetSpace = GAME_CONFIG.PLAYER_ROUTE[player][routePos];
  let threats = 0;

  for (let i = 0; i < NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner !== opponent || p.routePos < 0) continue;
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

/** Calculate game score advantage: positive = player is winning */
function getScoreAdvantage(state: GameState, player: PlayerId): number {
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const myHome = state.home[player].length;
  const oppHome = state.home[opponent].length;
  const myPips = pipCount(state, player);
  const oppPips = pipCount(state, opponent);
  return (myHome - oppHome) * 100 + (oppPips - myPips);
}

/** Count friendly pieces at a board space */
function friendlyCountAt(state: GameState, spaceIdx: number, player: PlayerId): number {
  return state.board[spaceIdx].filter(p => p.owner === player).length;
}

/** Count total pieces on the board for a player */
function piecesOnBoard(state: GameState, player: PlayerId): number {
  let count = 0;
  for (let i = 0; i < NUM_SPACES; i++) {
    count += state.board[i].filter(p => p.owner === player).length;
  }
  return count;
}

/** Count lone (unprotected) pieces on the board */
function lonePieceCount(state: GameState, player: PlayerId): number {
  let count = 0;
  for (let i = 0; i < NUM_SPACES; i++) {
    const friendly = state.board[i].filter(p => p.owner === player);
    if (friendly.length === 1) count++;
  }
  return count;
}

/** Get the routePos of the piece being moved */
function getMovingPiece(state: GameState, move: Move): { routePos: number; crowned: boolean } | null {
  if (move.from.type === 'board') {
    const piece = state.board[move.from.index].find(p => p.id === move.pieceId);
    if (piece) return { routePos: piece.routePos, crowned: piece.crowned };
  }
  return null;
}

/** Detect game phase */
function getGamePhase(state: GameState, player: PlayerId): 'opening' | 'midgame' | 'endgame' {
  const benchCount = state.bench[player].length;
  if (benchCount > 6) return 'opening';
  const crownedOnBoard = state.board.reduce((n, space) =>
    n + space.filter(p => p.owner === player && p.crowned).length, 0);
  if (benchCount === 0 && crownedOnBoard >= 3) return 'endgame';
  return 'midgame';
}

/** Count consecutive spaces with 2+ friendly pieces (blocking chains) */
function countBlockingChains(state: GameState, player: PlayerId): { chains: number; maxLen: number } {
  const route = GAME_CONFIG.PLAYER_ROUTE[player];
  let chains = 0, maxLen = 0, currentLen = 0;
  for (let rp = 0; rp < ROUTE_LENGTH; rp++) {
    const space = route[rp];
    const friendly = state.board[space].filter(p => p.owner === player).length;
    if (friendly >= 2) {
      currentLen++;
      if (currentLen > maxLen) maxLen = currentLen;
    } else {
      if (currentLen >= 2) chains++;
      currentLen = 0;
    }
  }
  if (currentLen >= 2) chains++;
  return { chains, maxLen };
}

/** Calculate pip count (total remaining distance) for a player */
function pipCount(state: GameState, player: PlayerId): number {
  let pips = 0;
  // Bench pieces need full route
  pips += state.bench[player].length * ROUTE_LENGTH;
  // Jail pieces need full route too
  pips += state.jail[player].length * ROUTE_LENGTH;
  // Board pieces need remaining distance
  for (let i = 0; i < NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner === player) pips += (ROUTE_LENGTH - p.routePos);
    }
  }
  return pips;
}

/** Enhanced board evaluation for Expert AI */
function evaluateBoardExpert(state: GameState, player: PlayerId): number {
  let score = evaluateBoard(state, player);
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const phase = getGamePhase(state, player);
  const advantage = getScoreAdvantage(state, player);

  // Blocking chain bonus
  const { chains, maxLen } = countBlockingChains(state, player);
  score += chains * 100;
  if (maxLen >= 3) score += 200;
  if (maxLen >= 4) score += 300;

  // Opponent blocking chain penalty
  const oppChains = countBlockingChains(state, opponent);
  score -= oppChains.chains * 80;
  if (oppChains.maxLen >= 3) score -= 150;

  // Pip count advantage
  const myPips = pipCount(state, player);
  const oppPips = pipCount(state, opponent);
  score += (oppPips - myPips) * 2;

  // ── IMPROVEMENT #1: Danger awareness with probability weighting ──
  // Penalize exposed pieces based on how likely they are to be captured
  for (let i = 0; i < NUM_SPACES; i++) {
    const friendly = state.board[i].filter(p => p.owner === player);
    if (friendly.length === 1) {
      const p = friendly[0];
      const threatWeight = countThreatsWeighted(state, p.routePos, player);
      // Scale penalty by probability (threatWeight out of ~36)
      score -= threatWeight * 8;
      // Crowned pieces even more important to protect
      if (p.crowned) score -= threatWeight * 5;
    }
  }

  // ── IMPROVEMENT #3: Adapt to game state ──
  if (advantage > 300) {
    // Winning big: play safe, penalize lone pieces extra
    const lones = lonePieceCount(state, player);
    score -= lones * 80;
    // Bonus for safe stacks when ahead
    for (let i = 0; i < NUM_SPACES; i++) {
      if (state.board[i].filter(p => p.owner === player).length >= 2) score += 50;
    }
  } else if (advantage < -300) {
    // Losing: reward aggression, captures, opponent jail
    score += state.jail[opponent].length * 100;
    // Less penalty for risky moves when behind
    const lones = lonePieceCount(state, player);
    score += lones * 20; // Spread out is OK when desperate
  }

  // ── IMPROVEMENT #5: Bearing-off strategy ──
  if (phase === 'endgame') {
    // Strongly reward borne-off pieces
    score += state.home[player].length * 300;

    // Reward pieces in last 5 (enables overshoot)
    let inLastFive = 0;
    let allInLastFive = true;
    for (let i = 0; i < NUM_SPACES; i++) {
      for (const p of state.board[i]) {
        if (p.owner === player) {
          if (p.routePos >= ROUTE_LENGTH - 5) {
            inLastFive++;
            score += 50; // Bonus for being in overshoot zone
          } else {
            allInLastFive = false;
          }
        }
      }
    }
    if (allInLastFive && state.bench[player].length === 0 && state.jail[player].length === 0) {
      score += 200; // Big bonus: overshoot now enabled
    }

    // Penalize farthest piece heavily — it's the bottleneck
    let farthestDist = 0;
    for (let i = 0; i < NUM_SPACES; i++) {
      for (const p of state.board[i]) {
        if (p.owner === player) {
          const dist = ROUTE_LENGTH - p.routePos;
          if (dist > farthestDist) farthestDist = dist;
        }
      }
    }
    score -= farthestDist * 5; // Penalize stragglers
  } else if (phase === 'opening') {
    score -= state.bench[player].length * 50;
  } else {
    // Midgame: crowned pieces valuable
    for (let i = 0; i < NUM_SPACES; i++) {
      for (const p of state.board[i]) {
        if (p.owner === player && p.crowned) score += 80;
      }
    }
  }

  // Opponent progress penalty
  for (let i = 0; i < NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner === opponent && p.crowned) score -= 60;
    }
  }

  return score;
}

/**
 * Score a move for the AI. Higher = better.
 */
function scoreMove(state: GameState, move: Move, difficulty: AIDifficulty): number {
  if (difficulty === 'easy') {
    return Math.random() * 100;
  }

  const player = state.currentPlayer;
  const opponent: PlayerId = player === 1 ? 2 : 1;
  const isHard = difficulty === 'hard' || difficulty === 'expert';
  const isExpert = difficulty === 'expert';
  const phase = isExpert ? getGamePhase(state, player) : 'midgame';
  let score = 0;

  const movingPiece = getMovingPiece(state, move);

  // ═══════════════════════════════════════════
  // BEARING OFF — always the best move
  // ═══════════════════════════════════════════
  if (move.bearsOff) {
    if (isExpert) {
      // Expert: prefer bearing off farthest piece first
      const movingP = getMovingPiece(state, move);
      const distBonus = movingP ? (ROUTE_LENGTH - movingP.routePos) * 10 : 0;
      return 5000 + distBonus + Math.random() * 5;
    }
    return 5000 + Math.random() * 10;
  }

  // ═══════════════════════════════════════════
  // CAPTURES — value depends on context
  // ═══════════════════════════════════════════
  if (move.captures && move.to.type === 'board') {
    // How far along is the piece we're capturing? More progress = more valuable capture
    const capturedPieces = state.board[move.to.index].filter(p => p.owner === opponent);
    const capturedProgress = capturedPieces.length > 0 ? capturedPieces[0].routePos : 0;
    const captureValue = 100 + capturedProgress * 15; // 100 base + up to 450 for advanced pieces

    // But how safe is our piece AFTER capturing?
    if (isHard) {
      const newState = executeMove(state, move);
      const destFriendly = friendlyCountAt(newState, move.to.index, player);
      const threats = countThreats(newState, (movingPiece?.routePos ?? 0) + move.diceValue, player);

      if (destFriendly >= 2) {
        // Safe capture — full value
        score += captureValue;
      } else if (threats === 0) {
        // No immediate threats — decent capture
        score += captureValue * 0.7;
      } else {
        // Exposed after capture — only worth it if the captured piece was very advanced
        if (capturedProgress > 15) {
          score += captureValue * (isExpert ? 0.3 : 0.4);
        } else {
          score -= isExpert ? 150 : 50; // Expert is much more cautious about risky captures
        }
      }

      // Expert: prefer using uncrowned pieces for captures when crowned pieces are available
      // A crowned piece is more valuable — don't risk it when an uncrowned one can do the job
      if (isExpert && movingPiece?.crowned && move.from.type === 'board') {
        const srcPieces = state.board[move.from.index!].filter(p => p.owner === player);
        const hasUncrowned = srcPieces.some(p => !p.crowned);
        if (hasUncrowned) {
          score -= 300; // Strong penalty for using crowned piece when uncrowned available
        }
        // Extra penalty if capture leaves crowned piece exposed
        if (destFriendly < 2 && threats > 0) {
          score -= 200; // Crowned piece exposed after capture is very bad
        }
      }
    } else {
      // Medium: simpler capture scoring
      score += captureValue;
    }
  }

  // ═══════════════════════════════════════════
  // CROWNING — good but not at all costs
  // ═══════════════════════════════════════════
  if (move.crowns) score += 120;

  // ═══════════════════════════════════════════
  // BENCH ENTRY — important to get pieces out
  // ═══════════════════════════════════════════
  if (move.from.type === 'bench') {
    const onBoard = piecesOnBoard(state, player);
    if (isExpert && phase === 'opening') {
      // Expert opening: very aggressive bench entry
      if (onBoard < 3) score += 400;
      else if (onBoard < 6) score += 300;
      else score += 150;
    } else {
      if (onBoard < 3) score += 250;
      else if (onBoard < 6) score += 150;
      else score += 60;
    }

    // Bonus if entering onto a space with a friendly piece (safe entry)
    if (move.to.type === 'board') {
      const destFriendly = friendlyCountAt(state, move.to.index, player);
      if (destFriendly > 0) score += 100; // Safe entry with a buddy
    }
  }

  // ═══════════════════════════════════════════
  // DESTINATION SAFETY — the most important factor for Hard AI
  // ═══════════════════════════════════════════
  if (move.to.type === 'board' && !move.captures) {
    const newState = executeMove(state, move);
    const destFriendly = friendlyCountAt(newState, move.to.index, player);
    const destRoutePos = (movingPiece?.routePos ?? 0) + move.diceValue;

    if (destFriendly >= 2) {
      // Landing with a buddy = very safe
      score += 250;
    } else if (destFriendly === 1) {
      // Landing alone
      if (isExpert) {
        // Use probability-weighted threats
        const threatWeight = countThreatsWeighted(newState, destRoutePos, player);
        if (threatWeight === 0) {
          score += 40;
        } else {
          // Adapt risk tolerance to game state
          const advantage = getScoreAdvantage(state, player);
          const riskMult = advantage > 300 ? 1.5 : advantage < -300 ? 0.5 : 1.0;
          score -= Math.round(threatWeight * 12 * riskMult);
        }
        const distFromHome = ROUTE_LENGTH - destRoutePos;
        if (distFromHome > 15) score -= 250;
        else if (distFromHome > 10) score -= 120;
      } else if (isHard) {
        const threats = countThreats(newState, destRoutePos, player);
        if (threats === 0) {
          score += 30;
        } else {
          score -= 150 * threats;
        }
        const distFromHome = ROUTE_LENGTH - destRoutePos;
        if (distFromHome > 15) score -= 100;
        else if (distFromHome > 10) score -= 50;
      } else {
        score -= 50;
      }
    }
  }

  // ═══════════════════════════════════════════
  // SOURCE SAFETY — don't break safe stacks
  // ═══════════════════════════════════════════
  if (isHard && move.from.type === 'board') {
    const srcBefore = friendlyCountAt(state, move.from.index, player);
    if (srcBefore === 2) {
      // Breaking a pair — leaves one piece exposed
      const newState = executeMove(state, move);
      const leftBehind = newState.board[move.from.index].find(p => p.owner === player);
      if (leftBehind) {
        const threats = countThreats(newState, leftBehind.routePos, player);
        score -= isExpert ? (200 + threats * 100) : (80 + threats * 60);
      }
    }

    // Expert: when leaving a stack, prefer to move uncrowned pieces and keep crowned ones safe
    if (isExpert && movingPiece?.crowned && srcBefore >= 2) {
      const srcPieces = state.board[move.from.index].filter(p => p.owner === player);
      const hasUncrowned = srcPieces.some(p => !p.crowned);
      // If there's an uncrowned piece that could move instead, penalize using crowned
      if (hasUncrowned && !move.bearsOff) {
        score -= 150;
      }
    }
  }

  // ═══════════════════════════════════════════
  // ADVANCEMENT — prefer moving pieces forward, but not recklessly
  // ═══════════════════════════════════════════
  if (movingPiece && !move.captures) {
    // Small bonus for advancing
    score += move.diceValue;

    // Hard: prefer advancing pieces that are BEHIND (catch up, move as a group)
    if (isHard) {
      // Pieces in the home stretch should advance (they're safe there)
      if (movingPiece.crowned) {
        score += 100;
      } else if (movingPiece.routePos > 18 && !movingPiece.crowned) {
        // Far along but not yet crowned — advance to get crowned
        score += 50;
      } else if (movingPiece.routePos > 12) {
        // Moderately advanced lone runner — slight penalty (let others catch up)
        const loners = lonePieceCount(state, player);
        if (loners > 2) score -= 40; // Too many exposed pieces, don't make it worse
      }
    }
  }

  // ═══════════════════════════════════════════
  // PROXIMITY TO FRIENDLIES — prefer staying in groups
  // ═══════════════════════════════════════════
  if (isHard && move.to.type === 'board' && movingPiece) {
    const destRoutePos = movingPiece.routePos + move.diceValue;
    for (let offset = 1; offset <= 4; offset++) {
      for (const dir of [offset, -offset]) {
        const nearbyPos = destRoutePos + dir;
        if (nearbyPos >= 0 && nearbyPos < ROUTE_LENGTH) {
          const nearbySpace = GAME_CONFIG.PLAYER_ROUTE[player][nearbyPos];
          const nearbyFriendly = friendlyCountAt(state, nearbySpace, player);
          if (nearbyFriendly > 0) score += 15; // Nearby friends are good
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // EXPERT: Blocking chain creation bonus
  // ═══════════════════════════════════════════
  if (isExpert && move.to.type === 'board') {
    const newState = executeMove(state, move);
    const newChains = countBlockingChains(newState, player);
    const oldChains = countBlockingChains(state, player);
    // Bonus for creating or extending chains
    if (newChains.maxLen > oldChains.maxLen) score += 150;
    if (newChains.chains > oldChains.chains) score += 80;
  }

  // ═══════════════════════════════════════════
  // EXPERT: Endgame bearing-off strategy
  // ═══════════════════════════════════════════
  if (isExpert && phase === 'endgame') {
    if (movingPiece?.crowned) {
      score += 150; // Push crowned pieces toward home
    }
    // Prioritize moving the farthest piece (it's the bottleneck)
    if (movingPiece) {
      let farthestPos = ROUTE_LENGTH;
      for (let i = 0; i < NUM_SPACES; i++) {
        for (const p of state.board[i]) {
          if (p.owner === player && p.routePos < farthestPos) farthestPos = p.routePos;
        }
      }
      if (movingPiece.routePos === farthestPos) {
        score += 200; // Big bonus for advancing the straggler
      }
    }
    // Bonus for moves that get pieces into the last-5 overshoot zone
    if (movingPiece && move.to.type === 'board') {
      const destPos = movingPiece.routePos + move.diceValue;
      if (destPos >= ROUTE_LENGTH - 5 && movingPiece.routePos < ROUTE_LENGTH - 5) {
        score += 100; // Entering overshoot zone
      }
    }
  }

  // ═══════════════════════════════════════════
  // EXPERT: Adapt risk to game state
  // ═══════════════════════════════════════════
  if (isExpert) {
    const advantage = getScoreAdvantage(state, player);
    if (advantage > 300 && move.captures) {
      // Winning big: don't take unnecessary risks for captures
      score -= 100;
    } else if (advantage < -300 && move.captures) {
      // Losing: be aggressive, captures are more valuable
      score += 150;
    }
  }

  // Small random factor to avoid predictability
  score += Math.random() * (isExpert ? 3 : 8);

  return score;
}

/**
 * Evaluate the overall board state quality for a player.
 * Used by Hard AI to compare end-states of different move sequences.
 */
function evaluateBoard(state: GameState, player: PlayerId): number {
  let score = 0;
  const opponent: PlayerId = player === 1 ? 2 : 1;

  // Pieces borne off = great
  score += state.home[player].length * 500;

  // Pieces in jail = bad
  score -= state.jail[player].length * 200;

  // Opponent in jail = good
  score += state.jail[opponent].length * 150;

  // Pieces still on bench = slightly bad (want them in play)
  score -= state.bench[player].length * 30;

  for (let i = 0; i < NUM_SPACES; i++) {
    const friendly = state.board[i].filter(p => p.owner === player);
    if (friendly.length === 0) continue;

    // Safe stacks (2+) = good
    if (friendly.length >= 2) score += 120;

    // Lone pieces = bad, especially with threats
    if (friendly.length === 1) {
      const p = friendly[0];
      const threats = countThreats(state, p.routePos, player);
      score -= 60 + threats * 50;
      // Worse if far from home
      const distFromHome = ROUTE_LENGTH - p.routePos;
      if (distFromHome > 15) score -= 40;
    }

    // Advance bonus
    for (const p of friendly) {
      score += p.routePos * 3;
      if (p.crowned) score += 80;
    }
  }

  return score;
}

/**
 * Choose the best move for the AI.
 * Hard difficulty: looks ahead at move pairs to find combinations that
 * create safe positions (e.g., two pieces from different stacks landing together).
 */
export function chooseBestMove(state: GameState, validMoves: Move[], difficulty: AIDifficulty): Move | null {
  if (validMoves.length === 0) return null;

  // Easy/Medium: just pick the best single move
  if (difficulty !== 'hard' && difficulty !== 'expert') {
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

  // Hard: evaluate move pairs (look-ahead within the turn)
  const remaining = state.dice.remaining;
  const hasTwoMoves = remaining.length >= 2;

  if (!hasTwoMoves) {
    // Only one die left — just pick the best single move
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

  // Try each first move, simulate it, then find the best second move.
  // Score the resulting board state after both moves.
  let bestFirstMove = validMoves[0];
  let bestPairScore = -Infinity;
  const player = state.currentPlayer;

  // Only check single-die moves as the first move (not combined)
  // so there's a die left for the second move
  const singleDieMoves = validMoves.filter(m => m.diceCount === 1);

  for (const firstMove of singleDieMoves) {
    const stateAfterFirst = executeMove(state, firstMove);

    // If turn switched (all dice used), evaluate this state
    if (stateAfterFirst.currentPlayer !== player) {
      const boardScore = evaluateBoard(stateAfterFirst, player);
      if (boardScore > bestPairScore) {
        bestPairScore = boardScore;
        bestFirstMove = firstMove;
      }
      continue;
    }

    // Find valid moves for the second die
    const secondMoves: Move[] = [];
    const seen = new Set<string>();
    for (const dv of stateAfterFirst.dice.remaining) {
      for (const m of getValidMoves(stateAfterFirst, dv)) {
        const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${m.diceValue}`;
        if (!seen.has(key)) { seen.add(key); secondMoves.push(m); }
      }
    }
    // Also include multi-step for second move
    for (const m of getMultiStepMoves(stateAfterFirst)) {
      const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${m.diceValue}`;
      if (!seen.has(key)) { seen.add(key); secondMoves.push(m); }
    }

    if (secondMoves.length === 0) {
      // No second move possible — evaluate state after first move only
      const boardScore = evaluateBoard(stateAfterFirst, player);
      if (boardScore > bestPairScore) {
        bestPairScore = boardScore;
        bestFirstMove = firstMove;
      }
      continue;
    }

    // Find the best second move (and for expert, look at third moves too)
    for (const secondMove of secondMoves) {
      const stateAfterBoth = executeMove(stateAfterFirst, secondMove);

      // Expert: 3-move look-ahead if dice remain
      if (difficulty === 'expert' && stateAfterBoth.currentPlayer === player && stateAfterBoth.dice.remaining.length > 0) {
        const thirdMoves: Move[] = [];
        const seen3 = new Set<string>();
        for (const dv of stateAfterBoth.dice.remaining) {
          for (const m of getValidMoves(stateAfterBoth, dv)) {
            const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${m.diceValue}`;
            if (!seen3.has(key)) { seen3.add(key); thirdMoves.push(m); }
          }
        }
        if (thirdMoves.length > 0) {
          for (const thirdMove of thirdMoves) {
            const stateAfterThree = executeMove(stateAfterBoth, thirdMove);
            const boardScore = evaluateBoardExpert(stateAfterThree, player);
            if (boardScore > bestPairScore) {
              bestPairScore = boardScore;
              bestFirstMove = firstMove;
            }
          }
          continue;
        }
      }

      const evalFn = difficulty === 'expert' ? evaluateBoardExpert : evaluateBoard;
      const boardScore = evalFn(stateAfterBoth, player);
      if (boardScore > bestPairScore) {
        bestPairScore = boardScore;
        bestFirstMove = firstMove;
      }
    }
  }

  // Also consider combined moves (using both dice at once) as alternatives
  const evalFn = difficulty === 'expert' ? evaluateBoardExpert : evaluateBoard;
  const combinedMoves = validMoves.filter(m => m.diceCount >= 2);
  for (const combined of combinedMoves) {
    const stateAfter = executeMove(state, combined);
    const boardScore = evalFn(stateAfter, player);
    if (boardScore > bestPairScore) {
      bestPairScore = boardScore;
      bestFirstMove = combined;
    }
  }

  return bestFirstMove;
}

/**
 * Choose the best Jester doubles value for the AI.
 */
export function chooseBestJesterValue(state: GameState, difficulty: AIDifficulty): number {
  if (difficulty === 'easy') {
    return Math.floor(Math.random() * 5) + 1;
  }

  const player = state.currentPlayer;
  let bestValue = 5;
  let bestScore = -Infinity;

  for (let v = 1; v <= 5; v++) {
    const simState: GameState = {
      ...state,
      dice: { ...state.dice, remaining: [v, v, v, v], pendingDoubleJester: false },
    };

    const moves = [
      ...getValidMoves(simState, v),
      ...getMultiStepMoves(simState),
    ];

    if (moves.length === 0) continue;

    if (difficulty === 'expert') {
      // Expert: greedily simulate all 4 moves for each value
      // Pick the best move at each step, then evaluate the final board
      let simS = simState;
      for (let step = 0; step < 4; step++) {
        if (simS.currentPlayer !== player) break; // turn ended
        const available = [
          ...getValidMoves(simS, v).filter(m => m.diceCount === 1),
          ...getMultiStepMoves(simS),
        ];
        if (available.length === 0) break;
        // Pick the best move at this step
        let bestMove = available[0];
        let bestMoveScore = -Infinity;
        for (const m of available) {
          const after = executeMove(simS, m);
          const s = evaluateBoardExpert(after, player);
          if (s > bestMoveScore) { bestMoveScore = s; bestMove = m; }
        }
        simS = executeMove(simS, bestMove);
      }
      const finalScore = evaluateBoardExpert(simS, player);
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestValue = v;
      }
    } else {
      // Medium/Hard: single best move score
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
  }

  return bestValue;
}
