import type { GameState, Move, Piece, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';

const { PLAYER_ROUTE, HOME_STRETCH_LENGTH, CAPTURE_MAX_OPPONENTS, NUM_SPACES } = GAME_CONFIG;
const ROUTE_LENGTH = GAME_CONFIG.ROUTE_LENGTH;

/** Get the board space index for a given route position */
function spaceAt(routePos: number, player: PlayerId): number {
  return PLAYER_ROUTE[player][routePos];
}

function isInHomeStretch(routePos: number): boolean {
  return routePos >= ROUTE_LENGTH - HOME_STRETCH_LENGTH;
}

function canLandOn(board: Piece[][], index: number, player: PlayerId): boolean {
  const occ = board[index];
  if (occ.length === 0) return true;
  if (occ[0].owner === player) return true;
  if (occ.length <= CAPTURE_MAX_OPPONENTS && occ[0].owner !== player) return true;
  return false;
}

function wouldCapture(board: Piece[][], index: number, player: PlayerId): boolean {
  const occ = board[index];
  return occ.length >= 1 && occ.length <= CAPTURE_MAX_OPPONENTS && occ[0].owner !== player;
}

/** Collect all of a player's pieces currently on the board, with their route positions. */
function getBoardPieces(state: GameState, player: PlayerId): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < NUM_SPACES; i++) {
    for (const p of state.board[i]) {
      if (p.owner === player) pieces.push(p);
    }
  }
  return pieces;
}

/** Try to create a board move or bear-off move for a piece. */
function tryMove(
  state: GameState, piece: Piece, totalDist: number,
  diceCount: number, diceConsumed: number[], player: PlayerId
): Move | null {
  const newPos = piece.routePos + totalDist;
  const fromSpace = spaceAt(piece.routePos, player);

  // Bearing off — piece must ALREADY be crowned (on the home stretch).
  // Exact roll required UNLESS all board pieces are in the home quadrant (last 5 spaces).
  // When overshooting, must bear off the farthest piece from home first.
  if (newPos >= ROUTE_LENGTH) {
    if (!piece.crowned) return null;
    const isExact = newPos === ROUTE_LENGTH;
    if (!isExact) {
      // Check if ALL of this player's pieces on the board are in the home quadrant (last 5)
      const homeQuadrantStart = ROUTE_LENGTH - 5; // positions 25-29
      const allInHomeQuadrant = !state.board.some((space) =>
        space.some(p =>
          p.owner === player && p.routePos >= 0 && p.routePos < homeQuadrantStart
        )
      ) && state.bench[player].length === 0 && state.jail[player].length === 0;
      if (!allInHomeQuadrant) return null;

      // Must bear off the farthest piece from home first
      // (lowest routePos = farthest from home)
      const boardPieces = getBoardPieces(state, player);
      const farthestPos = Math.min(...boardPieces.map(p => p.routePos));
      if (piece.routePos > farthestPos) return null; // not the farthest piece
    }
    return {
      pieceId: piece.id,
      from: { type: 'board', index: fromSpace },
      to: { type: 'home' },
      diceValue: totalDist, diceCount, diceConsumed,
      captures: false, crowns: false, bearsOff: true,
    };
  }

  const destSpace = spaceAt(newPos, player);
  if (!canLandOn(state.board, destSpace, player)) return null;

  return {
    pieceId: piece.id,
    from: { type: 'board', index: fromSpace },
    to: { type: 'board', index: destSpace },
    diceValue: totalDist, diceCount, diceConsumed,
    captures: wouldCapture(state.board, destSpace, player),
    crowns: !piece.crowned && isInHomeStretch(newPos),
    bearsOff: false,
  };
}

/** Check intermediate positions for equal-step path (doubles). */
function isEqualStepPathClear(board: Piece[][], routePos: number, step: number, count: number, player: PlayerId): boolean {
  for (let s = 1; s < count; s++) {
    const pos = routePos + s * step;
    if (pos >= ROUTE_LENGTH) return true;
    if (!canLandOn(board, spaceAt(pos, player), player)) return false;
  }
  return true;
}

/** Check if at least one ordering of two steps has a valid intermediate. */
function hasClearIntermediate(board: Piece[][], routePos: number, a: number, b: number, player: PlayerId): boolean {
  const posA = routePos + a;
  if (posA < ROUTE_LENGTH && canLandOn(board, spaceAt(posA, player), player)) return true;
  const posB = routePos + b;
  if (posB < ROUTE_LENGTH && canLandOn(board, spaceAt(posB, player), player)) return true;
  return false;
}

// ── Single-die moves ──────────────────────────────────────────────

export function getValidMoves(state: GameState, diceValue: number): Move[] {
  const player = state.currentPlayer;
  const moves: Move[] = [];

  // Jail re-entry (mandatory) — never crown on re-entry, piece starts fresh
  if (state.jail[player].length > 0) {
    const entryRoutePos = diceValue - 1;
    if (entryRoutePos < ROUTE_LENGTH) {
      const dest = spaceAt(entryRoutePos, player);
      if (canLandOn(state.board, dest, player)) {
        moves.push({
          pieceId: state.jail[player][0].id,
          from: { type: 'jail' }, to: { type: 'board', index: dest },
          diceValue, diceCount: 1, diceConsumed: [diceValue],
          captures: wouldCapture(state.board, dest, player),
          crowns: false, bearsOff: false,
        });
      }
    }
    return moves;
  }

  // Bench entry — only dice values 1-5 can enter (no 6)
  if (state.bench[player].length > 0 && diceValue <= 5) {
    const entryRoutePos = diceValue - 1;
    if (entryRoutePos < ROUTE_LENGTH) {
      const dest = spaceAt(entryRoutePos, player);
      if (canLandOn(state.board, dest, player)) {
        moves.push({
          pieceId: state.bench[player][0].id,
          from: { type: 'bench' }, to: { type: 'board', index: dest },
          diceValue, diceCount: 1, diceConsumed: [diceValue],
          captures: wouldCapture(state.board, dest, player),
          crowns: false, bearsOff: false,
        });
      }
    }
  }

  // Board moves — a single die of 6 cannot bear off (only move on board)
  const seen = new Set<string>();
  for (const piece of getBoardPieces(state, player)) {
    const m = tryMove(state, piece, diceValue, 1, [diceValue], player);
    if (m) {
      if (diceValue === 6 && m.bearsOff) continue; // can't bear off with a 6
      const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}`;
      if (!seen.has(key)) { seen.add(key); moves.push(m); }
    }
  }

  return moves;
}

// ── Combined multi-dice moves ─────────────────────────────────────

export function getMultiStepMoves(state: GameState): Move[] {
  const player = state.currentPlayer;
  const remaining = state.dice.remaining;
  if (remaining.length < 2) return [];
  if (state.jail[player].length > 0) return [];

  const moves: Move[] = [];
  const counts: Record<number, number> = {};
  for (const v of remaining) counts[v] = (counts[v] || 0) + 1;

  // ── Same-value combos (doubles) ──
  for (const [vs, count] of Object.entries(counts)) {
    if (count < 2) continue;
    const step = Number(vs);

    // Bench entry with same-value combo
    // Pieces entering from bench/jail can never be crowned — they must
    // physically travel the first two rows before reaching the home stretch.
    if (state.bench[player].length > 0) {
      const piece = state.bench[player][0];
      for (let n = 2; n <= count; n++) {
        const total = step * n;
        const entryPos = total - 1;
        if (entryPos >= ROUTE_LENGTH) break;
        // Cap bench entry before home stretch — piece must earn its way there
        if (isInHomeStretch(entryPos)) break;
        let ok = true;
        for (let s = 1; s < n; s++) {
          const mid = step * s - 1;
          if (mid >= ROUTE_LENGTH || !canLandOn(state.board, spaceAt(mid, player), player)) { ok = false; break; }
        }
        if (!ok) break;
        const dest = spaceAt(entryPos, player);
        if (!canLandOn(state.board, dest, player)) continue;
        moves.push({
          pieceId: piece.id, from: { type: 'bench' },
          to: { type: 'board', index: dest },
          diceValue: total, diceCount: n, diceConsumed: Array(n).fill(step),
          captures: wouldCapture(state.board, dest, player),
          crowns: false, bearsOff: false,
        });
      }
    }

    // Board moves with same-value combo
    const seen = new Set<string>();
    for (const piece of getBoardPieces(state, player)) {
      for (let n = 2; n <= count; n++) {
        const total = step * n;
        if (!isEqualStepPathClear(state.board, piece.routePos, step, n, player)) break;
        const m = tryMove(state, piece, total, n, Array(n).fill(step), player);
        if (m) {
          const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${total}`;
          if (!seen.has(key)) { seen.add(key); moves.push(m); }
        }
      }
    }
  }

  // ── Mixed-value combos (e.g., 5+2=7) ──
  const seenPairs = new Set<string>();
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = remaining[i], b = remaining[j];
      if (a === b) continue;
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      const total = a + b;
      const consumed = [a, b];

      // Bench entry with mixed combo — never crown, never enter home stretch
      if (state.bench[player].length > 0) {
        const piece = state.bench[player][0];
        const entryPos = total - 1;
        if (entryPos < ROUTE_LENGTH && !isInHomeStretch(entryPos)) {
          const midA = a - 1, midB = b - 1;
          const midAOk = midA < ROUTE_LENGTH && canLandOn(state.board, spaceAt(midA, player), player);
          const midBOk = midB < ROUTE_LENGTH && canLandOn(state.board, spaceAt(midB, player), player);
          if (midAOk || midBOk) {
            const dest = spaceAt(entryPos, player);
            if (canLandOn(state.board, dest, player)) {
              moves.push({
                pieceId: piece.id, from: { type: 'bench' },
                to: { type: 'board', index: dest },
                diceValue: total, diceCount: 2, diceConsumed: consumed,
                captures: wouldCapture(state.board, dest, player),
                crowns: false, bearsOff: false,
              });
            }
          }
        }
      }

      // Board moves with mixed combo
      const seen = new Set<string>();
      for (const piece of getBoardPieces(state, player)) {
        if (!hasClearIntermediate(state.board, piece.routePos, a, b, player)) continue;
        const m = tryMove(state, piece, total, 2, consumed, player);
        if (m) {
          const mkey = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${total}`;
          if (!seen.has(mkey)) { seen.add(mkey); moves.push(m); }
        }
      }
    }
  }

  return moves;
}

// ── Helpers ───────────────────────────────────────────────────────

export function canPlayerMove(state: GameState): boolean {
  if (state.dice.remaining.some(dv => getValidMoves(state, dv).length > 0)) return true;
  if (getMultiStepMoves(state).length > 0) return true;
  return false;
}

export function executeMove(state: GameState, move: Move): GameState {
  const s: GameState = JSON.parse(JSON.stringify(state));
  // Ensure captureCount exists (backward compat with old saved states)
  if (!s.captureCount) s.captureCount = { 1: 0, 2: 0 };
  const player = s.currentPlayer;

  // 1. Remove piece from source
  let piece: Piece;
  if (move.from.type === 'jail') {
    const idx = s.jail[player].findIndex(p => p.id === move.pieceId);
    piece = s.jail[player].splice(idx, 1)[0];
  } else if (move.from.type === 'bench') {
    const idx = s.bench[player].findIndex(p => p.id === move.pieceId);
    piece = s.bench[player].splice(idx, 1)[0];
  } else {
    const srcPieces = s.board[move.from.index];
    const idx = srcPieces.findIndex(p => p.id === move.pieceId);
    piece = srcPieces.splice(idx, 1)[0];
  }

  // 2. Update route position
  if (move.from.type === 'bench' || move.from.type === 'jail') {
    piece.routePos = move.diceValue - 1; // entering at this route position
  } else {
    piece.routePos = piece.routePos + move.diceValue;
  }

  // 3. Handle intermediate captures (multi-step moves capture along the way)
  if (move.diceCount > 1 && move.from.type === 'board') {
    const startRoutePos = piece.routePos - move.diceValue; // original position before step 2 updated it
    // Compute all intermediate landing positions from the dice consumed
    // For same-value [4,4,4]: intermediates at +4, +8 (not the final +12)
    // For mixed [5,2]: intermediates at +5 and +2 (both orderings)
    const intermediatePositions = new Set<number>();

    if (move.diceConsumed.every(d => d === move.diceConsumed[0])) {
      // Same-value: intermediates at step, 2*step, ... (n-1)*step
      const step = move.diceConsumed[0];
      for (let i = 1; i < move.diceCount; i++) {
        const pos = startRoutePos + step * i;
        if (pos < ROUTE_LENGTH) intermediatePositions.add(pos);
      }
    } else {
      // Mixed values: add each individual die value as a possible intermediate
      for (const d of move.diceConsumed) {
        const pos = startRoutePos + d;
        if (pos < ROUTE_LENGTH) intermediatePositions.add(pos);
      }
    }

    // Capture lone opponents at each intermediate
    for (const intPos of intermediatePositions) {
      const intSpace = GAME_CONFIG.PLAYER_ROUTE[player][intPos];
      const occupants = s.board[intSpace];
      if (occupants.length === 1 && occupants[0].owner !== player) {
        const captured = occupants.splice(0, 1);
        captured.forEach(cp => {
          if (GAME_CONFIG.CAPTURE_REMOVES_CROWN) cp.crowned = false;
          cp.routePos = -1;
          s.jail[cp.owner].push(cp);
          s.captureCount[player]++;
          s.moveLog.push({
            turn: s.turnCount, player,
            action: `${GAME_CONFIG.PLAYER_NAMES[player]} captured en passant at space ${intSpace}!`,
            timestamp: Date.now(),
          });
        });
      }
    }
  }

  // Also handle intermediate captures for bench/jail multi-step entry
  if (move.diceCount > 1 && (move.from.type === 'bench' || move.from.type === 'jail')) {
    const intermediatePositions = new Set<number>();
    if (move.diceConsumed.every(d => d === move.diceConsumed[0])) {
      const step = move.diceConsumed[0];
      for (let i = 1; i < move.diceCount; i++) {
        const pos = step * i - 1; // bench entry: route position = total - 1
        if (pos >= 0 && pos < ROUTE_LENGTH) intermediatePositions.add(pos);
      }
    } else {
      for (const d of move.diceConsumed) {
        const pos = d - 1;
        if (pos >= 0 && pos < ROUTE_LENGTH) intermediatePositions.add(pos);
      }
    }

    for (const intPos of intermediatePositions) {
      const intSpace = GAME_CONFIG.PLAYER_ROUTE[player][intPos];
      const occupants = s.board[intSpace];
      if (occupants.length === 1 && occupants[0].owner !== player) {
        const captured = occupants.splice(0, 1);
        captured.forEach(cp => {
          if (GAME_CONFIG.CAPTURE_REMOVES_CROWN) cp.crowned = false;
          cp.routePos = -1;
          s.jail[cp.owner].push(cp);
          s.captureCount[player]++;
          s.moveLog.push({
            turn: s.turnCount, player,
            action: `${GAME_CONFIG.PLAYER_NAMES[player]} captured en passant at space ${intSpace}!`,
            timestamp: Date.now(),
          });
        });
      }
    }
  }

  // 3b. Handle capture at final destination
  if (move.captures && move.to.type === 'board') {
    const capturedPieces = s.board[move.to.index].splice(0, s.board[move.to.index].length);
    capturedPieces.forEach(cp => {
      if (GAME_CONFIG.CAPTURE_REMOVES_CROWN) cp.crowned = false;
      cp.routePos = -1;
      s.jail[cp.owner].push(cp);
      s.captureCount[player]++;
    });
  }

  // 4. Crown if entering home stretch
  if (move.crowns) piece.crowned = true;

  // 5. Place piece
  if (move.to.type === 'home') {
    s.home[player].push(piece);
  } else {
    s.board[move.to.index].push(piece);
  }

  // 6. Consume dice
  for (const val of move.diceConsumed) {
    const idx = s.dice.remaining.indexOf(val);
    if (idx !== -1) s.dice.remaining.splice(idx, 1);
  }

  // 7. Log
  s.moveLog.push({
    turn: s.turnCount, player,
    action: describeMove(move, player),
    timestamp: Date.now(),
  });

  // 8. Check if turn ends
  const outOfMoves = s.dice.remaining.length === 0 || !canPlayerMoveWith(s);
  const awaitingJesterChoice = s.dice.remaining.length === 0 && s.dice.pendingDoubleJester;
  if (outOfMoves && !awaitingJesterChoice) {
    s.currentPlayer = player === 1 ? 2 : 1;
    s.dice = { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJester: false };
    s.phase = 'rolling';
    s.turnCount++;
  }

  return s;
}

function canPlayerMoveWith(state: GameState): boolean {
  if (state.dice.remaining.some(dv => getValidMoves(state, dv).length > 0)) return true;
  if (getMultiStepMoves(state).length > 0) return true;
  return false;
}

function describeMove(move: Move, player: PlayerId): string {
  const name = GAME_CONFIG.PLAYER_NAMES[player];
  const from = move.from.type === 'jail' ? 'jail' : move.from.type === 'bench' ? 'bench' : `space ${move.from.index}`;
  const to = move.to.type === 'home' ? 'home' : `space ${move.to.index}`;
  const diceLabel = move.diceCount > 1
    ? `${move.diceConsumed.join('+')}=${move.diceValue}`
    : String(move.diceValue);
  let desc = `${name} moved ${from} → ${to} (${diceLabel})`;
  if (move.captures) desc += ' — captured!';
  if (move.crowns) desc += ' — crowned!';
  if (move.bearsOff) desc += ' — borne off!';
  return desc;
}
