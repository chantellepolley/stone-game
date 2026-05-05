import type { Piece, PlayerId } from '../types/game';

export interface PuzzleDef {
  id: string;
  name: string;
  category: 'bear_off' | 'capture' | 'jester';
  difficulty: 'apprentice' | 'journeyman' | 'master';
  description: string;
  objective: string;
  /** Cost in coins to unlock (0 = free) */
  cost: number;
  /** Coin reward for completing */
  reward: number;
  /** Fixed dice values */
  dice: [number, number];
  /** Whether dice are doubles (4 moves) */
  isDoubles: boolean;
  /** Pre-set board pieces: [owner, routePos, crowned?][] */
  pieces: { owner: PlayerId; routePos: number; crowned?: boolean }[];
  /** Pieces already borne off (home) */
  homeCount?: { 1: number; 2: number };
  /** Win condition checker — receives final state, returns true if puzzle solved */
  checkSolved: (state: {
    home: Record<PlayerId, { length: number }>;
    jail: Record<PlayerId, { length: number }>;
    capturedThisPuzzle: number;
  }) => boolean;
  /** Hint text shown after 2 failed attempts */
  hint: string;
  /** Max moves allowed (0 = use all dice) */
  maxMoves?: number;
}

/**
 * Build board + bench + home arrays from puzzle piece definitions.
 * Returns pieces placed on the board with proper IDs.
 */
export function buildPuzzleState(puzzle: PuzzleDef) {
  const board: Piece[][] = Array.from({ length: 20 }, () => []);
  const bench: Record<PlayerId, Piece[]> = { 1: [], 2: [] };
  const jail: Record<PlayerId, Piece[]> = { 1: [], 2: [] };
  const home: Record<PlayerId, Piece[]> = { 1: [], 2: [] };

  // Route-to-board mapping
  const PLAYER_ROUTE: Record<PlayerId, number[]> = {
    1: [0,1,2,3,4,5,6,7,8,9, 10,11,12,13,14,15,16,17,18,19, 0,1,2,3,4,5,6,7,8,9],
    2: [19,18,17,16,15,14,13,12,11,10, 9,8,7,6,5,4,3,2,1,0, 19,18,17,16,15,14,13,12,11,10],
  };

  const counters: Record<PlayerId, number> = { 1: 0, 2: 0 };

  puzzle.pieces.forEach(p => {
    const id = `p${p.owner}-${counters[p.owner]}`;
    counters[p.owner]++;
    const crowned = p.crowned ?? (p.routePos >= 20); // auto-crown in home stretch
    const boardIndex = PLAYER_ROUTE[p.owner][p.routePos];
    const piece: Piece = { id, owner: p.owner, crowned, routePos: p.routePos };
    board[boardIndex].push(piece);
  });

  // Add home pieces
  const homeCount = puzzle.homeCount || { 1: 0, 2: 0 };
  for (let i = 0; i < homeCount[1]; i++) {
    home[1].push({ id: `p1-home-${i}`, owner: 1, crowned: true, routePos: 30 });
  }
  for (let i = 0; i < homeCount[2]; i++) {
    home[2].push({ id: `p2-home-${i}`, owner: 2, crowned: true, routePos: 30 });
  }

  return { board, bench, jail, home };
}

// ─── PUZZLE 1: Bear Off ───────────────────────────────────────────
// You have 3 crowned pieces near the end. Roll is 3,2.
// Bear off all 3 pieces using a combined 3+2=5 move and individual moves.
const bearOffPuzzle: PuzzleDef = {
  id: 'bear-off-1',
  name: 'Race to the Finish',
  category: 'bear_off',
  difficulty: 'apprentice',
  description: 'Your pieces are almost home. Use your dice wisely to bear them all off!',
  objective: 'Bear off all 3 of your pieces in one turn',
  cost: 0, // Free intro puzzle
  reward: 10,
  dice: [3, 2],
  isDoubles: false,
  // P1 pieces at routePos 27 (3 away), 28 (2 away), 25 (5 away)
  // With dice 3,2: move pos27 by 3 (home), pos28 by 2 (home), pos25 by 5 (combined 3+2, home)
  // But we only have 2 dice values... need to think about this differently.
  // With 3 and 2: can bear off pos27 with 3, pos28 with 2. That's 2 pieces.
  // For 3 pieces we need doubles. Let's simplify: 2 pieces to bear off.
  // Actually let's make it 2 pieces — cleaner for an intro puzzle.
  pieces: [
    { owner: 1, routePos: 27 }, // 3 spaces from home
    { owner: 1, routePos: 28 }, // 2 spaces from home
  ],
  homeCount: { 1: 11, 2: 0 },
  checkSolved: (state) => state.home[1].length >= 13,
  hint: 'Use the 3 on the piece that is 3 spaces away, and the 2 on the piece that is 2 spaces away.',
};

// ─── PUZZLE 2: Capture ────────────────────────────────────────────
// Opponent has 2 exposed pieces. You rolled 4,3.
// Find the right moves to capture both.
const capturePuzzle: PuzzleDef = {
  id: 'capture-1',
  name: 'Double Trouble',
  category: 'capture',
  difficulty: 'apprentice',
  description: 'Your opponent left two stones exposed. Capture them both!',
  objective: 'Capture both opponent pieces in one turn',
  cost: 0, // Free intro puzzle
  reward: 10,
  dice: [4, 3],
  isDoubles: false,
  // P1 piece at routePos 5 (board space 5).
  // Opponent pieces at routePos that maps to spaces reachable by 4 and 3.
  // P1 at board space 5 (routePos 5), move +3 = space 8 (routePos 8), move +4 = space 9 (routePos 9)
  // Place opponent singles at space 8 and space 9
  // P2 routePos for space 8: P2 route maps space 8 to routePos 12 (9,8,7,6,5,4,3,2,1,0 -> index 1 is space 8...
  // Actually let's just put the P2 pieces by their route positions.
  // P2 route: [19,18,17,16,15,14,13,12,11,10, 9,8,7,6,5,4,3,2,1,0, ...]
  // Board space 8 = P2 routePos 12 (index 12 in P2's route)
  // Board space 9 = P2 routePos 11 (wait: index 10 = space 9, index 11 = space 8)
  // Let me recount: P2 route index 0=19, 1=18, 2=17, 3=16, 4=15, 5=14, 6=13, 7=12, 8=11, 9=10, 10=9, 11=8
  // So space 9 = P2 routePos 10, space 8 = P2 routePos 11
  // P1 piece A at routePos 2 (space 2) + dice 4 = routePos 6 (space 6, capture!)
  // P1 piece B at routePos 10 (space 10) + dice 3 = routePos 13 (space 13, capture!)
  // P2 at space 6 = P2 routePos 13 (P2 route: idx 13 = space 6)
  // P2 at space 13 = P2 routePos 6 (P2 route: idx 6 = space 13)
  pieces: [
    { owner: 1, routePos: 2 },   // P1 piece at board space 2
    { owner: 1, routePos: 10 },  // P1 piece at board space 10
    { owner: 2, routePos: 13 },  // P2 piece at board space 6 (single, capturable)
    { owner: 2, routePos: 6 },   // P2 piece at board space 13 (single, capturable)
    // Safe P2 stack
    { owner: 2, routePos: 3 },
    { owner: 2, routePos: 3 },
  ],
  homeCount: { 1: 11, 2: 0 },
  checkSolved: (state) => state.jail[2].length >= 2,
  hint: 'Each piece can reach one opponent. Use the 4 on one and the 3 on the other.',
};

// ─── PUZZLE 3: Jester Mastery ─────────────────────────────────────
// You rolled double jesters! Pick the right doubles value to bear off
// your remaining pieces. Only one value works.
const jesterPuzzle: PuzzleDef = {
  id: 'jester-1',
  name: 'Jester Genius',
  category: 'jester',
  difficulty: 'journeyman',
  description: 'Double Jesters! You must use 1 and 2 first, then choose the right doubles value to win.',
  objective: 'Bear off all remaining pieces using Double Jesters',
  cost: 25,
  reward: 15,
  dice: [6, 6], // Double jesters
  isDoubles: true,
  // After using 1 and 2 (mandatory), player chooses a value for 4 more moves.
  // Set up so only choosing "3" works:
  // P1 pieces at routePos 29 (1 from home), 28 (2 from home), and 3 pieces at routePos 27 (3 from home)
  // Step 1: use 1 to bear off pos29
  // Step 2: use 2 to bear off pos28
  // Step 3: choose doubles of 3 -> four moves of 3
  // Use 3 to bear off each of the pieces at pos27 (but we only have 4 moves and need 3 pieces)
  // Let's do: pos29, pos28, pos27, pos27, pos27
  // That's 5 pieces. 1+2 = 2 moves for first two. Then 4x3 = 4 moves for... we only need 3.
  // Let's add a 4th piece at pos27 so all 4 moves of the chosen value are used.
  // Total: 6 pieces. 1 at pos29, 1 at pos28, 4 at pos27. Home has 7.
  // Move 1: use 1 on pos29 -> home (8)
  // Move 2: use 2 on pos28 -> home (9)
  // Choose 3. Move 3-6: use 3 on each pos27 -> home (10,11,12,13) = WIN!
  // If they choose 2: pos27+2=pos29, then need to bear off from 29 with remaining 2s...
  //   pos29 needs 1 to bear off. Can't use 2 to bear off from pos29 (overshoot only if ALL in last 5).
  //   All pieces ARE in last 5 (pos25-29), so overshoot IS allowed. That means 2 would also work.
  // Let's adjust: put pieces NOT all in last 5 to prevent overshoot.
  // Put one piece at pos24 (6 from home) to block overshoot.
  // pos24: needs exactly 6 to bear off, but 6 is jester face, can't use it.
  // Actually with doubles choice of any 1-5, you can't move 6.
  // Let's rethink. Put pieces at specific positions where only value 4 works:
  // pos29 (1 away), pos28 (2 away), pos26 (4 away), pos26 (4 away), pos26 (4 away)
  // Wait, I have mandatory 1,2 first. So:
  // Move with 1: bear off pos29
  // Move with 2: bear off pos28
  // Now choose value. 3 remaining pieces at pos26 (4 away).
  // Choose 4: bear off pos26 x3 with 3 of the 4 moves. 4th move wasted (no pieces).
  // But we need exactly right. Let's have 4 pieces at pos26 = 4 away.
  // Move with 1: pos29 -> home
  // Move with 2: pos28 -> home
  // Choose 4: 4 moves of 4. Bear off pos26 x4 -> all home. Perfect!
  // If choose 3: pos26+3=pos29. Not home. Then need to bear off from 29 next move with 3?
  //   Overshoot from pos29 by 3 = pos32, way past. Overshoot allowed only if ALL pieces in last 5 (pos25-29).
  //   After first move of 3: one piece at 29, three at 26. All in last 5 (25-29). So overshoot IS allowed.
  //   Hmm. Let me place a piece outside last 5 to block.
  // Put one piece at routePos 22 (8 from home). This blocks overshoot.
  // New setup: pos29, pos28, pos22, pos26, pos26, pos26, pos26
  // That's 7 pieces on board, 6 in home = 13 total.
  // Move 1: pos29 -> home (via 1)
  // Move 2: pos28 -> home (via 2)
  // Now pos22 is still on board (not in last 5), so overshoot NOT allowed.
  // Choose 4: pos26+4=pos30=home x4. pos22 still there. Only bore off 4 of remaining 5.
  // Hmm, that doesn't win either. We need ALL pieces home.
  //
  // OK simpler approach. Just 4 pieces total left:
  // pos29 (1 away), pos28 (2 away), pos27 (3 away), pos27 (3 away)
  // Home has 9 pieces.
  // Mandatory: use 1 -> bear off pos29. use 2 -> bear off pos28.
  // Choose 3: 4 moves of 3. Bear off pos27 x2. Done! (2 moves used, 2 wasted) = win with 13 home
  // Choose 4: pos27+4=over. Need all in last 5. After bearing off 29,28: remaining at pos27,27.
  //   pos27 IS in last 5 (25-29). So overshoot allowed with 4. That also works!
  // Choose 2: pos27+2=pos29. Not home. Then next 2: pos29+2=over.
  //   All remaining at 29 and 27. All in last 5 -> overshoot allowed. pos29+2=home. pos27 still at 27.
  //   Then pos27+2=pos29. pos29+2=home. But wait, we only have 4 moves of chosen value.
  //   Move3: pos27+2=29. Move4: pos29+2=home. Move5: pos27+2=29. Move6: pos29+2=home. Yes 4 moves, 2 pieces done.
  //   That also works! Ugh.
  //
  // I need to design these more carefully. Let me think of a scenario where only ONE value works.
  //
  // Setup: pos29, pos28, pos26 (4 away), and pos22 (8 away, NOT in last 5)
  // 4 pieces on board, 9 home.
  // Mandatory: 1->pos29 home. 2->pos28 home. Remaining: pos26, pos22. 11 home.
  // Overshoot blocked because pos22 is NOT in last 5.
  // Choose 4: pos26+4=home! pos22+4=pos26. 2 moves used, pos22 now at pos26.
  //   pos26+4=home! 3 moves used. All board pieces done! 13 home. WIN!
  //   Wait: 4 moves of 4. Move3: pos26+4=home. Move4: pos22+4=26. Move5: pos26+4=home. Move6: nothing.
  //   That's only 3 useful moves out of 4. And we'd have 13 home. Yes that works!
  // Choose 3: pos26+3=pos29. pos22+3=pos25. Now at 29 and 25. Both in last 5? 25-29 yes.
  //   Overshoot now allowed? No — we check at time of move. When moving pos22+3=25, pos26 is still on board at 26.
  //   All pieces are 26 and 22. Not all in last 5. So can't overshoot on first move.
  //   Actually the bear-off overshoot check is done per move, looking at ALL pieces' positions at that moment.
  //   Move3: pos26+3=29 (not home, just advance). Move4: pos22+3=25.
  //   Now remaining pieces at 29 and 25. Both in last 5. Overshoot allowed.
  //   Move5: pos29+3=home! Move6: pos25+3=28. Not home (need to reach 30 exactly... wait routePos 28+3=31>30).
  //   With overshoot allowed, 28+3=home? Let me check the engine.
  //   Actually overshoot is: if ALL pieces are in last 5 spaces (routePos 25-29), then any roll >= remaining distance bears off.
  //   pos25+3=28. That's just moving forward, not bearing off. To bear off from 25 you need 5 (exact) or more if overshoot.
  //   25 is 5 away from home. 3 < 5. Can't bear off. Just moves to 28.
  //   So choose 3: Move3: 26->29. Move4: 22->25. Move5: 29->home(overshoot ok). Move6: 25->28.
  //   Only 1 more piece left at 28. No more moves. FAIL. Only 12 home.
  // Choose 2: pos26+2=28. pos22+2=24. Move5: 28+2=home(30 exactly!). Move6: 24+2=26.
  //   Only 12 home. FAIL.
  // Choose 5: pos26+5=home(31, overshoot?)! pos22 not in last 5. Overshoot blocked. 26+5=31>30.
  //   Need exact from pos26=4 away. 5>4. Not in last 5 for all pieces (22 isn't). FAIL.
  //   pos22+5=27. Move4: 27+5=home(32, overshoot? 22 was moved to 27, now at 27. Other piece at 26.
  //   All at 26,27 — both in last 5. Overshoot OK. 27+5=home! But wait, order matters.
  //   Move3: can we bear off pos26 with 5? pos26 is 4 away. Need >=4. But all pieces not in last 5 (pos22).
  //   So exact only. 5 ≠ 4. Can't bear off. Just advance: 26+5=31... can't go past 30. Move blocked?
  //   Actually you CAN'T advance past routePos 29 without bearing off. So 26+5 is invalid entirely.
  //   Move3: pos22+5=27. Move4: pos26+5 = invalid. Only option is advance 22 again: 27+5=32 = also invalid.
  //   FAIL.
  // Choose 1: pos26+1=27. pos22+1=23. Way too slow. FAIL.
  //
  // So only value 4 works! Perfect puzzle.

  pieces: [
    { owner: 1, routePos: 29 }, // 1 space from home (crowned)
    { owner: 1, routePos: 28 }, // 2 spaces from home (crowned)
    { owner: 1, routePos: 26 }, // 4 spaces from home (crowned)
    { owner: 1, routePos: 22 }, // 8 spaces from home (crowned)
  ],
  homeCount: { 1: 9, 2: 0 },
  checkSolved: (state) => state.home[1].length >= 13,
  hint: 'After using 1 and 2, think about which doubles value lets you bear off the piece at position 26 AND move the far piece into range.',
};

// ─── PUZZLE 4: The Masterstroke (Hard) ─────────────────────────────
// Two P1 pieces, two P2 targets. Dice 5,2.
// Only solution: use BOTH dice on piece A in the right order (2 first, then 5).
// Traps: splitting dice between pieces gives only 1 capture.
//        Using 5 on A first moves it past target X without capturing.
const masterstrokePuzzle: PuzzleDef = {
  id: 'masterstroke-1',
  name: 'The Masterstroke',
  category: 'capture',
  difficulty: 'master',
  description: 'Two targets, two pieces, but only one path captures both. Every move counts.',
  objective: 'Capture both opponent pieces in one turn',
  cost: 50,
  reward: 25,
  dice: [5, 2],
  isDoubles: false,
  // P1 piece A at routePos 1 (space 1). P1 piece B at routePos 6 (space 6, red herring).
  // P2 single at space 3 (routePos 3 for P1, reachable by A with 2: 1+2=3, capture!)
  // P2 single at space 8 (routePos 8 for P1, reachable by A with 5 FROM space 3: 3+5=8, capture!)
  // P2 space 3 = P2 routePos 16. P2 space 8 = P2 routePos 11.
  // Wrong: A uses 5 first (goes to space 6, stacks with B, no capture), then only 1 target reachable.
  // Wrong: Split dice between A and B — each can only reach 1 target.
  // Only correct: A uses 2 first (capture at 3), then A uses 5 (capture at 8).
  pieces: [
    { owner: 1, routePos: 1 },   // Piece A at space 1
    { owner: 1, routePos: 6 },   // Piece B at space 6 (distraction)
    { owner: 2, routePos: 16 },  // P2 target at space 3
    { owner: 2, routePos: 11 },  // P2 target at space 8
    // Safe P2 stacks for context
    { owner: 2, routePos: 1 },
    { owner: 2, routePos: 1 },
  ],
  homeCount: { 1: 11, 2: 0 },
  checkSolved: (state) => state.jail[2].length >= 2,
  hint: 'One piece must do all the work. Think about which die to use first so you land on BOTH targets.',
};

export const PUZZLES: PuzzleDef[] = [
  bearOffPuzzle,
  capturePuzzle,
  jesterPuzzle,
  masterstrokePuzzle,
];
