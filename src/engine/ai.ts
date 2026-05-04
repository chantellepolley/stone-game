import type { GameState, Move, AIDifficulty, PlayerId } from '../types/game';
import { getValidMoves, getMultiStepMoves, executeMove } from './moves';
import { GAME_CONFIG } from '../config/gameConfig';

const ROUTE_LENGTH = GAME_CONFIG.ROUTE_LENGTH;
const NUM_SPACES = GAME_CONFIG.NUM_SPACES;

/** Count how many of the opponent's pieces could reach a board space within dice range */
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

  // Blocking chain bonus
  const { chains, maxLen } = countBlockingChains(state, player);
  score += chains * 100;
  if (maxLen >= 3) score += 200; // Prime bonus
  if (maxLen >= 4) score += 300;

  // Opponent blocking chain penalty
  const oppChains = countBlockingChains(state, opponent);
  score -= oppChains.chains * 80;
  if (oppChains.maxLen >= 3) score -= 150;

  // Pip count advantage
  const myPips = pipCount(state, player);
  const oppPips = pipCount(state, opponent);
  score += (oppPips - myPips) * 2; // Bonus for being ahead in the race

  // Phase-specific bonuses
  if (phase === 'opening') {
    // Penalize having too many pieces on bench
    score -= state.bench[player].length * 50;
  } else if (phase === 'endgame') {
    // Crowned pieces more valuable
    for (let i = 0; i < NUM_SPACES; i++) {
      for (const p of state.board[i]) {
        if (p.owner === player && p.crowned) score += 120; // extra on top of base 80
      }
    }
    // Borne off pieces even more valuable in endgame
    score += state.home[player].length * 200;
  }

  // Opponent progress penalty — pieces in their home stretch are dangerous
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
      if (isHard) {
        const threats = countThreats(newState, destRoutePos, player);
        if (threats === 0) {
          score += 30; // No threats, acceptable
        } else {
          score -= (isExpert ? 250 : 150) * threats;
        }

        // Extra penalty for lone pieces far from home
        const distFromHome = ROUTE_LENGTH - destRoutePos;
        if (isExpert) {
          if (distFromHome > 15) score -= 200;
          else if (distFromHome > 10) score -= 100;
        } else {
          if (distFromHome > 15) score -= 100;
          else if (distFromHome > 10) score -= 50;
        }
      } else {
        score -= 50; // Medium: mild lone penalty
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
  // EXPERT: Endgame crowned advancement
  // ═══════════════════════════════════════════
  if (isExpert && phase === 'endgame' && movingPiece?.crowned) {
    score += 150; // Strong push to bear off crowned pieces
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
      // Expert: simulate best 2-move sequence for each value
      let bestSeqScore = -Infinity;
      const singleMoves = moves.filter(m => m.diceCount === 1);
      for (const m1 of singleMoves) {
        const s1 = executeMove(simState, m1);
        if (s1.currentPlayer !== player) {
          const bs = evaluateBoardExpert(s1, player);
          if (bs > bestSeqScore) bestSeqScore = bs;
          continue;
        }
        // Try second move
        for (const dv of s1.dice.remaining) {
          for (const m2 of getValidMoves(s1, dv)) {
            const s2 = executeMove(s1, m2);
            const bs = evaluateBoardExpert(s2, player);
            if (bs > bestSeqScore) bestSeqScore = bs;
          }
        }
      }
      // Also try combined moves
      for (const mc of moves.filter(m => m.diceCount >= 2)) {
        const sc = executeMove(simState, mc);
        const bs = evaluateBoardExpert(sc, player);
        if (bs > bestSeqScore) bestSeqScore = bs;
      }
      if (bestSeqScore > bestScore) {
        bestScore = bestSeqScore;
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
