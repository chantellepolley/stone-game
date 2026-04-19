import { useState, useCallback } from 'react';
import type { GameState, GamePhase, Move, Piece } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import { getValidMoves } from '../engine/moves';
import { executeMove } from '../engine/moves';
import { checkWinCondition } from '../engine/victory';
import Board from './Board';
import DiceArea from './DiceArea';
import Piece from './Piece';

interface TutorialProps {
  onFinish: () => void;
}

// Helper to create a piece
function piece(owner: 1 | 2, idx: number, routePos: number, crowned = false): Piece {
  return { id: `p${owner}-${idx}`, owner, crowned, routePos };
}

// Helper to create an empty board
function emptyBoard(): Piece[][] {
  return Array.from({ length: 20 }, () => []);
}

// Helper to place a piece on the board at its route position
function placeOnBoard(board: Piece[][], p: Piece, player: 1 | 2) {
  if (p.routePos >= 0 && p.routePos < 30) {
    const space = GAME_CONFIG.PLAYER_ROUTE[player][p.routePos];
    board[space].push(p);
  }
}

interface TutorialStep {
  title: string;
  description: string;
  state: GameState;
  allowedMoves?: Move[]; // if set, only these moves are valid
  autoAdvance?: boolean; // advance on "Next" button instead of action
  diceOverride?: [number, number]; // show specific dice
}

function makeDice(v1: number, v2: number, remaining: number[]): GameState['dice'] {
  return { values: [v1, v2], remaining, hasRolled: true, pendingDoubleJester: false };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: emptyBoard(),
    bench: { 1: [], 2: [] },
    jail: { 1: [], 2: [] },
    home: { 1: [], 2: [] },
    currentPlayer: 1,
    dice: { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJester: false },
    phase: 'rolling' as GamePhase,
    gameMode: 'pvp' as const,
    aiDifficulty: 'medium' as const,
    winner: null,
    moveLog: [],
    turnCount: 1,
    captureCount: { 1: 0, 2: 0 },
    ...overrides,
  };
}

function buildSteps(): TutorialStep[] {
  // Step 1: Welcome
  const welcomeState = baseState({ phase: 'not_started' as GamePhase });

  // Step 2: Roll the dice
  const rollState = baseState({
    bench: {
      1: Array.from({ length: 13 }, (_, i) => piece(1, i, -1)),
      2: Array.from({ length: 13 }, (_, i) => piece(2, i, -1)),
    },
    phase: 'rolling' as GamePhase,
  });

  // Step 3: Enter a piece (after rolling 3 and 4)
  const enterBoard = emptyBoard();
  const enterBench1 = Array.from({ length: 13 }, (_, i) => piece(1, i, -1));
  const enterState = baseState({
    board: enterBoard,
    bench: {
      1: enterBench1,
      2: Array.from({ length: 13 }, (_, i) => piece(2, i, -1)),
    },
    dice: makeDice(3, 4, [3, 4]),
    phase: 'moving' as GamePhase,
  });

  // Step 4: Move a piece (piece already on board at routePos 2, roll is 3+5)
  const moveBoard = emptyBoard();
  const movePiece = piece(1, 0, 2);
  placeOnBoard(moveBoard, movePiece, 1);
  const moveBench1 = Array.from({ length: 12 }, (_, i) => piece(1, i + 1, -1));
  const moveState = baseState({
    board: moveBoard,
    bench: {
      1: moveBench1,
      2: Array.from({ length: 13 }, (_, i) => piece(2, i, -1)),
    },
    dice: makeDice(3, 5, [3, 5]),
    phase: 'moving' as GamePhase,
  });

  // Step 5: Capture (opponent stone at routePos 4, our piece at routePos 1, roll is 3)
  const captureBoard = emptyBoard();
  const ourPiece = piece(1, 0, 1);
  const theirPiece = piece(2, 0, 18); // P2 routePos 18 = board space 1 (they wrap around)
  placeOnBoard(captureBoard, ourPiece, 1);
  // Place opponent manually at space index 4 (P1's route position 4)
  const oppSpace = GAME_CONFIG.PLAYER_ROUTE[1][4];
  const oppPiece = piece(2, 1, -1); // we'll place manually
  oppPiece.routePos = 4; // fake routePos for display
  captureBoard[oppSpace].push(oppPiece);
  // Actually we need to set up properly - P1 piece at routePos 1, roll 3, lands on routePos 4
  // Space at routePos 4 for P1 = PLAYER_ROUTE[1][4] = 4
  // We need an opponent piece there
  const captureBoard2 = emptyBoard();
  const capturePiece1 = piece(1, 0, 1);
  placeOnBoard(captureBoard2, capturePiece1, 1);
  const capturePieceOpp = piece(2, 5, -1);
  captureBoard2[GAME_CONFIG.PLAYER_ROUTE[1][4]].push(capturePieceOpp); // opponent at our route pos 4
  const captureState = baseState({
    board: captureBoard2,
    bench: {
      1: Array.from({ length: 12 }, (_, i) => piece(1, i + 1, -1)),
      2: Array.from({ length: 12 }, (_, i) => piece(2, i, -1)),
    },
    dice: makeDice(3, 2, [3]),
    phase: 'moving' as GamePhase,
  });

  // Step 6: Crowning (piece at routePos 19, roll 1 → enters home stretch at 20)
  const crownBoard = emptyBoard();
  const crownPiece = piece(1, 0, 19);
  placeOnBoard(crownBoard, crownPiece, 1);
  const crownState = baseState({
    board: crownBoard,
    bench: {
      1: Array.from({ length: 12 }, (_, i) => piece(1, i + 1, -1)),
      2: Array.from({ length: 13 }, (_, i) => piece(2, i, -1)),
    },
    dice: makeDice(1, 2, [1]),
    phase: 'moving' as GamePhase,
  });

  // Step 7: Bearing off (crowned piece at routePos 27, roll 3 → exactly 30)
  const bearBoard = emptyBoard();
  const bearPiece = piece(1, 0, 27, true);
  placeOnBoard(bearBoard, bearPiece, 1);
  const bearState = baseState({
    board: bearBoard,
    bench: { 1: [], 2: Array.from({ length: 13 }, (_, i) => piece(2, i, -1)) },
    home: { 1: Array.from({ length: 12 }, (_, i) => piece(1, i + 1, -1, true)), 2: [] },
    dice: makeDice(3, 2, [3]),
    phase: 'moving' as GamePhase,
  });

  // Step 8: Done!
  const doneState = baseState({ phase: 'not_started' as GamePhase });

  return [
    {
      title: "Welcome to STONE!",
      description: "Let's walk through how to play. You'll learn to roll dice, move stones, capture opponents, and bear off to win. This only takes a minute!",
      state: welcomeState,
      autoAdvance: true,
    },
    {
      title: "Step 1: Roll the Dice",
      description: "Each turn starts with a dice roll. Your dice have faces 1–5 and a Jester (instead of 6). Tap the Roll button to roll!",
      state: rollState,
      autoAdvance: false,
    },
    {
      title: "Step 2: Enter a Stone",
      description: "Use a die value to bring a stone from your Start area onto the board. The number determines how far along your path it enters. Tap a highlighted stone to place it!",
      state: enterState,
      autoAdvance: false,
    },
    {
      title: "Step 3: Move a Stone",
      description: "Stones travel 1.5 laps around the board (30 spaces). Tap a highlighted stone on the board, then tap where to move it. You can use each die separately or combine them.",
      state: moveState,
      autoAdvance: false,
    },
    {
      title: "Step 4: Capture!",
      description: "Land on a space with a single opponent stone to capture it — it goes to The Stoned Dungeon (jail)! They must re-enter jailed stones before making other moves.",
      state: captureState,
      autoAdvance: false,
    },
    {
      title: "Step 5: Crowning",
      description: "When a stone enters the home stretch (last 10 spaces), it gets crowned with the Jester symbol. Only crowned stones can bear off!",
      state: crownState,
      autoAdvance: false,
    },
    {
      title: "Step 6: Bear Off to Win!",
      description: "Use an exact roll to move a crowned stone off the board and into your Home. First player to bear off all 13 stones wins!",
      state: bearState,
      autoAdvance: false,
    },
    {
      title: "You're Ready!",
      description: "You know the basics! Remember: Jester + any number = 4 moves of that number. Doubles also give 4 moves. A 6 (Jester) can't enter the board or bear off. Good luck!",
      state: doneState,
      autoAdvance: true,
    },
  ];
}

export default function Tutorial({ onFinish }: TutorialProps) {
  const [steps] = useState(buildSteps);
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<GameState>(steps[0].state);
  const [rolled, setRolled] = useState(false);

  const step = steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  const advance = useCallback(() => {
    const next = stepIdx + 1;
    if (next >= steps.length) {
      localStorage.setItem('stone_tutorial_complete', '1');
      onFinish();
      return;
    }
    setStepIdx(next);
    setState(steps[next].state);
    setRolled(false);
  }, [stepIdx, steps, onFinish]);

  const handleRoll = useCallback(() => {
    if (step.autoAdvance || rolled) return;
    // Set scripted dice for this step
    const nextStep = steps[stepIdx + 1];
    if (nextStep) {
      setState(nextStep.state);
      setRolled(true);
      // Auto-advance after showing dice
      setTimeout(() => {
        setStepIdx(stepIdx + 1);
        setRolled(false);
      }, 1200);
    }
  }, [step, rolled, steps, stepIdx]);

  const handleSelectMove = useCallback((move: Move) => {
    // Execute the move on the tutorial state
    const newState = executeMove(state, move);
    setState(newState);
    // Advance after a brief pause
    setTimeout(advance, 800);
  }, [state, advance]);

  // Compute valid moves for action steps
  const validMoves = (state.phase === 'moving' && !step.autoAdvance)
    ? (() => {
        const moves: Move[] = [];
        const seen = new Set<string>();
        for (const dv of state.dice.remaining) {
          for (const m of getValidMoves(state, dv)) {
            const key = `${m.pieceId}:${m.to.type === 'home' ? 'H' : m.to.index}:${m.diceValue}`;
            if (!seen.has(key)) { seen.add(key); moves.push(m); }
          }
        }
        return moves;
      })()
    : [];

  const handleSkip = () => {
    localStorage.setItem('stone_tutorial_complete', '1');
    onFinish();
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-0.5 lg:gap-1 overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <header className="shrink-0">
        <img src="/logo.png" alt="STONE" className="h-8 sm:h-12 lg:h-20 object-contain" />
      </header>

      {/* Step indicator */}
      <div className="flex items-center gap-1 shrink-0">
        {steps.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full transition-colors ${i === stepIdx ? 'bg-amber-400' : i < stepIdx ? 'bg-amber-600/50' : 'bg-white/20'}`} />
        ))}
      </div>

      {/* Info card */}
      <div className="bg-[#504840] border-2 border-amber-600/40 rounded-xl px-3 py-2 lg:p-4 shadow-2xl max-w-md w-full text-center shrink-0">
        <h2 className="text-amber-400 font-heading text-sm lg:text-lg mb-0.5 lg:mb-1">{step.title}</h2>
        <p className="text-white text-[11px] lg:text-sm leading-relaxed">{step.description}</p>
      </div>

      {/* Game area (for action steps) */}
      {!step.autoAdvance && (
        <>
          {/* Dice */}
          <div className="shrink-0">
            <DiceArea
              dice={state.dice}
              phase={state.phase}
              currentPlayer={1}
              onRoll={state.phase === 'rolling' ? handleRoll : () => {}}
              isAITurn={state.phase !== 'rolling'}
            />
          </div>

          {/* Board */}
          {state.phase === 'moving' && (
            <div className="flex-1 w-full max-w-[1050px] min-h-0">
              <Board
                state={state}
                validMoves={validMoves}
                onSelectMove={handleSelectMove}
                hintsEnabled={true}
              />
            </div>
          )}
        </>
      )}

      {/* Auto-advance spacer for welcome/done screens */}
      {step.autoAdvance && <div className="flex-1" />}

      {/* Bottom buttons */}
      <div className="flex items-center gap-3 shrink-0 py-1 lg:py-2">
        {step.autoAdvance && (
          <button onClick={advance}
            className="px-6 lg:px-8 py-2.5 lg:py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-amber-600 text-white border-2 border-amber-500
                       hover:bg-amber-500 hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg">
            {isFirst ? "Let's Go!" : isLast ? "Start Playing!" : 'Next'}
          </button>
        )}
        <button onClick={handleSkip}
          className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[10px] lg:text-xs font-heading uppercase tracking-wider
                     text-white/50 hover:text-white transition-colors cursor-pointer">
          {isLast ? 'Close' : 'Skip Tutorial'}
        </button>
      </div>
    </div>
  );
}
