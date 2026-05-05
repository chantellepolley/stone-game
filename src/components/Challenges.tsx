import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GameState, GamePhase, Move } from '../types/game';
import { getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJester } from '../engine/dice';
import { PUZZLES, buildPuzzleState, type PuzzleDef } from '../data/puzzles';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { addCoins } from '../lib/coins';
import Board from './Board';
import DiceArea from './DiceArea';
import JesterCoin from './JesterCoin';

interface ChallengesProps {
  onBack: () => void;
}

function goHome(onBack: () => void) {
  localStorage.removeItem('stone_menu_view');
  onBack();
}

// ─── Helpers ──────────────────────────────────────────────────────

function createPuzzleGameState(puzzle: PuzzleDef): GameState {
  const { board, bench, jail, home } = buildPuzzleState(puzzle);

  const remaining: number[] = [];
  const [d1, d2] = puzzle.dice;
  const d1J = isJester(d1), d2J = isJester(d2);
  if (d1J && d2J) {
    // Double jesters: must use 1 and 2 first
    remaining.push(1, 2);
  } else if (d1J || d2J) {
    const normal = d1J ? d2 : d1;
    remaining.push(normal, normal, normal, normal);
  } else if (d1 === d2) {
    remaining.push(d1, d1, d1, d1);
  } else {
    remaining.push(d1, d2);
  }

  return {
    board,
    bench,
    jail,
    home,
    currentPlayer: 1,
    dice: {
      values: puzzle.dice,
      remaining,
      hasRolled: true,
      pendingDoubleJester: d1J && d2J,
    },
    phase: 'moving' as GamePhase,
    gameMode: 'pvp' as const,
    aiDifficulty: 'medium' as const,
    winner: null,
    moveLog: [],
    turnCount: 1,
    captureCount: { 1: 0, 2: 0 },
  };
}

function computeValidMoves(state: GameState, awaitingJesterChoice?: boolean): Move[] {
  if (state.phase !== 'moving') return [];
  if (awaitingJesterChoice) return [];
  const seen = new Set<string>();
  const moves: Move[] = [];

  for (const dv of new Set(state.dice.remaining)) {
    for (const m of getValidMoves(state, dv)) {
      const key = `${m.pieceId}:${m.from.type === 'board' ? m.from.index : m.from.type}:${m.to.type === 'board' ? m.to.index : 'home'}:${m.diceConsumed.join(',')}`;
      if (!seen.has(key)) { seen.add(key); moves.push(m); }
    }
  }
  for (const m of getMultiStepMoves(state)) {
    const key = `${m.pieceId}:${m.from.type === 'board' ? m.from.index : m.from.type}:${m.to.type === 'board' ? m.to.index : 'home'}:${m.diceConsumed.join(',')}`;
    if (!seen.has(key)) { seen.add(key); moves.push(m); }
  }
  return moves;
}

// ─── Saved progress ───────────────────────────────────────────────

function getCompletedPuzzles(): Set<string> {
  try {
    const raw = localStorage.getItem('stone_completed_puzzles');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markPuzzleCompleted(puzzleId: string) {
  const completed = getCompletedPuzzles();
  completed.add(puzzleId);
  localStorage.setItem('stone_completed_puzzles', JSON.stringify([...completed]));
}

function getUnlockedPuzzles(): Set<string> {
  try {
    const raw = localStorage.getItem('stone_unlocked_puzzles');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markPuzzleUnlocked(puzzleId: string) {
  const unlocked = getUnlockedPuzzles();
  unlocked.add(puzzleId);
  localStorage.setItem('stone_unlocked_puzzles', JSON.stringify([...unlocked]));
}

// ─── Category info ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  bear_off: { label: 'Bear Off', icon: '\u{1F3E0}' },
  capture: { label: 'Capture', icon: '\u2694\uFE0F' },
  jester: { label: 'Jester', icon: '\u{1F0CF}' },
  strategy: { label: 'Strategy', icon: '\u{1F9E0}' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  apprentice: 'text-green-400',
  journeyman: 'text-amber-400',
  master: 'text-red-400',
  grandmaster: 'text-purple-400',
};

// ─── Component ────────────────────────────────────────────────────

export default function Challenges({ onBack }: ChallengesProps) {
  const { player } = usePlayerContext();
  const { coins, refreshCoins } = useCoins();
  const [activePuzzle, setActivePuzzle] = useState<PuzzleDef | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [completed, setCompleted] = useState(getCompletedPuzzles);
  const [unlocked, setUnlocked] = useState(getUnlockedPuzzles);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [showTurnBanner, setShowTurnBanner] = useState(false);
  const capturedThisPuzzle = useRef(0);
  const undoStack = useRef<GameState[]>([]);

  const awaitingJesterChoice = state
    ? state.dice.pendingDoubleJester && state.dice.remaining.length === 0 && state.phase === 'moving'
    : false;

  const validMoves = useMemo(
    () => state ? computeValidMoves(state, awaitingJesterChoice) : [],
    [state, awaitingJesterChoice]
  );

  const canUndo = undoStack.current.length > 0 && state?.phase === 'moving';

  // ── Start a puzzle ──
  const startPuzzle = useCallback((puzzle: PuzzleDef) => {
    const gs = createPuzzleGameState(puzzle);
    setState(gs);
    setActivePuzzle(puzzle);
    setAttempts(0);
    setSolved(false);
    setFailed(false);
    setRewardClaimed(false);
    setCurrentTurn(1);
    setShowTurnBanner(false);
    capturedThisPuzzle.current = 0;
    undoStack.current = [];
  }, []);

  // ── Unlock a puzzle ──
  const handleUnlock = useCallback(async (puzzle: PuzzleDef) => {
    if (!player || (coins ?? 0) < puzzle.cost) return;
    await addCoins(player.id, -puzzle.cost, `Unlocked puzzle: ${puzzle.name}`);
    await refreshCoins();
    markPuzzleUnlocked(puzzle.id);
    setUnlocked(getUnlockedPuzzles());
  }, [player, coins, refreshCoins]);

  // ── Select move ──
  const selectMove = useCallback((move: Move) => {
    if (!state || state.phase !== 'moving') return;
    undoStack.current.push(JSON.parse(JSON.stringify(state)));

    let newState = executeMove(state, move);
    if (move.captures) capturedThisPuzzle.current++;

    const winner = checkWinCondition(newState);
    if (winner) {
      newState = { ...newState, winner, phase: 'game_over' };
    }

    setState(newState);
  }, [state]);

  // ── Undo ──
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    // Recalculate captured count from the restored state vs original
    capturedThisPuzzle.current = Math.max(0, capturedThisPuzzle.current - 1);
    setState(prev);
    setFailed(false);
  }, []);

  // ── Jester choice ──
  const chooseJesterDoubles = useCallback((value: number) => {
    if (!state || !state.dice.pendingDoubleJester || state.dice.remaining.length > 0) return;
    undoStack.current.push(JSON.parse(JSON.stringify(state)));
    const newState: GameState = {
      ...state,
      dice: { ...state.dice, remaining: [value, value, value, value], pendingDoubleJester: false },
    };
    setState(newState);
  }, [state]);

  // ── Reset puzzle ──
  const resetPuzzle = useCallback(() => {
    if (!activePuzzle) return;
    setAttempts(prev => prev + 1);
    const gs = createPuzzleGameState(activePuzzle);
    setState(gs);
    setSolved(false);
    setFailed(false);
    setCurrentTurn(1);
    setShowTurnBanner(false);
    capturedThisPuzzle.current = 0;
    undoStack.current = [];
  }, [activePuzzle]);

  // ── Transition to turn 2 for multi-turn puzzles ──
  const advanceToTurn2 = useCallback(() => {
    if (!state || !activePuzzle?.turn2Dice) return;
    const [d1, d2] = activePuzzle.turn2Dice;
    const d1J = isJester(d1), d2J = isJester(d2);
    const remaining: number[] = [];
    if (d1J && d2J) { remaining.push(1, 2); }
    else if (d1J || d2J) { const n = d1J ? d2 : d1; remaining.push(n, n, n, n); }
    else if (activePuzzle.turn2IsDoubles || d1 === d2) { remaining.push(d1, d1, d1, d1); }
    else { remaining.push(d1, d2); }

    setState(prev => prev ? {
      ...prev,
      dice: { values: activePuzzle.turn2Dice!, remaining, hasRolled: true, pendingDoubleJester: d1J && d2J },
      phase: 'moving' as GamePhase,
      currentPlayer: 1 as const,
    } : prev);
    setCurrentTurn(2);
    setShowTurnBanner(true);
    undoStack.current = [];
    setTimeout(() => setShowTurnBanner(false), 2000);
  }, [state, activePuzzle]);

  // ── Check win/fail after each move ──
  useEffect(() => {
    if (!state || !activePuzzle || solved) return;

    // Check if puzzle is solved
    const checkState = {
      home: state.home,
      jail: state.jail,
      capturedThisPuzzle: capturedThisPuzzle.current,
    };
    if (activePuzzle.checkSolved(checkState)) {
      setSolved(true);
      return;
    }

    // Check if out of moves (and puzzle not solved = fail)
    if (state.phase === 'moving' && state.dice.remaining.length > 0 && !awaitingJesterChoice) {
      if (!canPlayerMove(state)) {
        // Multi-turn: if turn 1 ended with blocked moves and there's a turn 2, advance
        if (currentTurn === 1 && activePuzzle.turn2Dice) {
          advanceToTurn2();
          return;
        }
        setFailed(true);
      }
    }
    // Turn ended (all dice used or blocked)
    const turnEnded = state.phase === 'rolling' || state.phase === 'no_moves' ||
      (state.phase === 'moving' && state.dice.remaining.length === 0 && !state.dice.pendingDoubleJester);
    if (turnEnded) {
      // Multi-turn: advance to turn 2 if available
      if (currentTurn === 1 && activePuzzle.turn2Dice) {
        advanceToTurn2();
        return;
      }
      if (!activePuzzle.checkSolved(checkState)) {
        setFailed(true);
      }
    }
  }, [state, activePuzzle, solved, awaitingJesterChoice, currentTurn, advanceToTurn2]);

  // ── Claim reward ──
  const claimReward = useCallback(async () => {
    if (!player || !activePuzzle || rewardClaimed) return;
    if (!completed.has(activePuzzle.id)) {
      await addCoins(player.id, activePuzzle.reward, `Puzzle completed: ${activePuzzle.name}`);
      await refreshCoins();
      markPuzzleCompleted(activePuzzle.id);
      setCompleted(getCompletedPuzzles());
    }
    setRewardClaimed(true);
  }, [player, activePuzzle, rewardClaimed, completed, refreshCoins]);

  // ─── Puzzle gameplay view ───────────────────────────────────────
  if (activePuzzle && state) {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#302b26' }}>
        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={() => { setActivePuzzle(null); setState(null); }}
              className="text-white/50 text-xs hover:text-white/80 transition-colors cursor-pointer font-heading uppercase tracking-wider">
              Back
            </button>
            <img src="/logo.png" alt="STONE" className="h-10 object-contain cursor-pointer" onClick={() => goHome(onBack)} />
            <div className="w-12" />
          </div>
          <h2 className="text-amber-400 font-heading text-sm uppercase tracking-wider text-center mt-1">{activePuzzle.name}</h2>
          <p className="text-white/50 text-[10px] text-center">{activePuzzle.objective}</p>
          {activePuzzle.turn2Dice && (
            <div className="flex justify-center gap-2 mt-1">
              <span className={`text-[10px] font-heading uppercase tracking-wider px-2 py-0.5 rounded ${currentTurn === 1 ? 'bg-amber-600/30 text-amber-400' : 'text-white/20'}`}>Turn 1</span>
              <span className={`text-[10px] font-heading uppercase tracking-wider px-2 py-0.5 rounded ${currentTurn === 2 ? 'bg-amber-600/30 text-amber-400' : 'text-white/20'}`}>Turn 2</span>
            </div>
          )}
        </div>

        {/* Dice display */}
        <div className="shrink-0 flex items-center justify-center gap-2 py-2">
          <DiceArea
            dice={state.dice}
            phase={state.phase}
            currentPlayer={1}
            onRoll={() => {}}
            awaitingJesterChoice={awaitingJesterChoice}
            onChooseJesterDoubles={chooseJesterDoubles}
          />
        </div>

        {/* Board */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-2">
          <div className="w-full max-w-lg">
            <Board
              state={state}
              validMoves={solved || failed ? [] : validMoves}
              onSelectMove={selectMove}
              hintsEnabled={true}
              myPlayer={1}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="shrink-0 px-4 py-3 flex items-center justify-center gap-3">
          {canUndo && !solved && (
            <button onClick={undo}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         bg-black/30 text-white/60 hover:text-white border border-[#6b5f55]
                         cursor-pointer transition-colors">
              Undo
            </button>
          )}
          <button onClick={resetPuzzle}
            className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-black/30 text-white/60 hover:text-white border border-[#6b5f55]
                       cursor-pointer transition-colors">
            Reset
          </button>
        </div>

        {/* Hint (after 2 failed attempts) */}
        {attempts >= 2 && !solved && (
          <div className="shrink-0 px-6 pb-2">
            <p className="text-amber-400/60 text-[10px] text-center italic">
              Hint: {activePuzzle.hint}
            </p>
          </div>
        )}

        {/* Turn 2 transition banner */}
        {showTurnBanner && (
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-40 animate-[slideIn_0.3s_ease-out]">
            <div className="bg-[#504840] border-2 border-amber-600/60 rounded-xl px-8 py-4 shadow-2xl text-center">
              <p className="text-amber-400 font-heading text-lg uppercase tracking-wider">Turn 2</p>
              <p className="text-white/50 text-[10px] mt-1">New dice loaded</p>
            </div>
          </div>
        )}

        {/* Solved overlay */}
        {solved && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#504840] border-2 border-amber-600/60 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
              <p className="text-4xl mb-2">&#127942;</p>
              <h2 className="text-amber-400 font-heading text-xl mb-1">Puzzle Solved!</h2>
              <p className="text-white/60 text-sm mb-4">{activePuzzle.name} complete</p>
              {!completed.has(activePuzzle.id) && !rewardClaimed && (
                <button onClick={claimReward}
                  className="px-6 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                             bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors
                             shadow-lg mb-3 inline-flex items-center gap-2">
                  Claim +{activePuzzle.reward} <JesterCoin size={16} />
                </button>
              )}
              {(completed.has(activePuzzle.id) || rewardClaimed) && (
                <p className="text-white/40 text-xs mb-3">Reward already claimed</p>
              )}
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setActivePuzzle(null); setState(null); }}
                  className="px-5 py-2 rounded-lg font-heading text-xs uppercase tracking-wider
                             bg-black/30 text-white/60 hover:text-white border border-[#6b5f55]
                             cursor-pointer transition-colors">
                  Back to Puzzles
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {failed && !solved && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#504840] border-2 border-red-600/40 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
              <p className="text-3xl mb-2">&#128528;</p>
              <h2 className="text-red-400 font-heading text-lg mb-1">Not Quite!</h2>
              <p className="text-white/60 text-sm mb-4">
                {activePuzzle.category === 'bear_off' ? "You didn't bear off all pieces." :
                 activePuzzle.category === 'capture' ? "You didn't capture enough pieces." :
                 "Try a different approach."}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={undo}
                  className="px-5 py-2 rounded-lg font-heading text-xs uppercase tracking-wider
                             bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                  Undo Last Move
                </button>
                <button onClick={resetPuzzle}
                  className="px-5 py-2 rounded-lg font-heading text-xs uppercase tracking-wider
                             bg-black/30 text-white/60 hover:text-white border border-[#6b5f55]
                             cursor-pointer transition-colors">
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Puzzle list view ───────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col" style={{ background: '#302b26' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-center mb-2">
          <img src="/logo.png" alt="STONE" className="h-12 object-contain cursor-pointer" onClick={() => goHome(onBack)} />
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => { localStorage.setItem('stone_menu_view', 'challenges'); onBack(); }}
            className="text-white/50 text-xs hover:text-white/80 transition-colors cursor-pointer font-heading uppercase tracking-wider">
            Back
          </button>
          <h1 className="text-amber-400 font-heading text-lg uppercase tracking-wider">Puzzles</h1>
          <div className="flex items-center gap-1 text-amber-400 text-sm font-heading">
            <JesterCoin size={16} /> {coins}
          </div>
        </div>
        <p className="text-white/40 text-[10px] text-center mt-1">
          Solve board puzzles to earn coins. Find the right moves!
        </p>
      </div>

      {/* Puzzle list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {PUZZLES.map(puzzle => {
            const isCompleted = completed.has(puzzle.id);
            const isUnlocked = puzzle.cost === 0 || unlocked.has(puzzle.id);
            const canAfford = (coins ?? 0) >= puzzle.cost;
            const cat = CATEGORY_LABELS[puzzle.category] || { label: puzzle.category, icon: '' };

            return (
              <div key={puzzle.id}
                className={`rounded-xl border-2 p-4 transition-all ${
                  isCompleted
                    ? 'bg-[#504840]/60 border-green-600/30'
                    : isUnlocked
                    ? 'bg-[#504840] border-amber-600/40 hover:border-amber-600/70'
                    : 'bg-[#3d3632] border-[#6b5f55]/40'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <div>
                      <h3 className="text-white font-heading text-sm">{puzzle.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-white/40">{cat.label}</span>
                        <span className={`text-[9px] uppercase tracking-wider ${DIFFICULTY_COLORS[puzzle.difficulty]}`}>
                          {puzzle.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isCompleted && <span className="text-green-400 text-lg">&#10003;</span>}
                </div>

                <p className="text-white/50 text-xs mb-3">{puzzle.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-white/40">
                    <span>Reward: <span className="text-amber-400 inline-flex items-center gap-0.5">+{puzzle.reward} <JesterCoin size={10} /></span></span>
                    <span>Dice: {puzzle.dice.map(d => d === 6 ? 'J' : d).join(', ')}{puzzle.turn2Dice ? ` + ${puzzle.turn2Dice.map(d => d === 6 ? 'J' : d).join(', ')}` : ''}</span>
                    {puzzle.turn2Dice && <span className="text-purple-400">2 turns</span>}
                  </div>

                  {isUnlocked ? (
                    <button onClick={() => startPuzzle(puzzle)}
                      className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                                 bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                      {isCompleted ? 'Replay' : 'Play'}
                    </button>
                  ) : (
                    <button onClick={() => canAfford && handleUnlock(puzzle)}
                      disabled={!canAfford}
                      className={`px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                                 inline-flex items-center gap-1 transition-colors
                                 ${canAfford
                                   ? 'bg-amber-600 text-white hover:bg-amber-500 cursor-pointer'
                                   : 'bg-black/30 text-white/30 cursor-not-allowed'
                                 }`}>
                      <JesterCoin size={12} /> {puzzle.cost} Unlock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming soon */}
        <div className="max-w-md mx-auto mt-6 text-center">
          <p className="text-white/20 text-xs font-heading uppercase tracking-wider">More puzzles coming soon</p>
        </div>
      </div>
    </div>
  );
}
