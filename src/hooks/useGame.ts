import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GameState, Move, GameMode, AIDifficulty } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJoker } from '../engine/dice';
import { chooseBestMove, chooseBestJokerValue } from '../engine/ai';
import { GAME_CONFIG } from '../config/gameConfig';
import { playCrownedSound, playHomeSound, playJailedSound } from '../utils/sounds';

function applyRoll(prev: GameState): GameState {
  if (prev.phase !== 'rolling') return prev;
  const dice = rollDice();
  const newState: GameState = { ...prev, dice, phase: 'moving' };

  if (!canPlayerMove(newState)) {
    return {
      ...newState,
      currentPlayer: newState.currentPlayer === 1 ? 2 : 1,
      dice: { values: dice.values, remaining: [], hasRolled: false, pendingDoubleJoker: false },
      phase: 'rolling',
      turnCount: newState.turnCount + 1,
      moveLog: [
        ...newState.moveLog,
        {
          turn: newState.turnCount,
          player: newState.currentPlayer,
          action: `${newState.currentPlayer === 1 ? 'Sunstone' : 'Moonstone'} rolled ${isJoker(dice.values[0]) ? 'Joker' : dice.values[0]}, ${isJoker(dice.values[1]) ? 'Joker' : dice.values[1]} — no valid moves`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  const d1Joker = isJoker(dice.values[0]);
  const d2Joker = isJoker(dice.values[1]);
  const d1Label = d1Joker ? 'Joker' : String(dice.values[0]);
  const d2Label = d2Joker ? 'Joker' : String(dice.values[1]);
  let rollNote = '';
  if (d1Joker && d2Joker) {
    rollNote = ' — Double Jokers! Move 1 & 2, then choose doubles';
  } else if (d1Joker || d2Joker) {
    const normalVal = d1Joker ? dice.values[1] : dice.values[0];
    rollNote = ` — Joker! 4x${normalVal}`;
  } else if (dice.values[0] === dice.values[1]) {
    rollNote = ' (doubles!)';
  }

  return {
    ...newState,
    moveLog: [
      ...newState.moveLog,
      {
        turn: newState.turnCount,
        player: newState.currentPlayer,
        action: `${newState.currentPlayer === 1 ? 'Sunstone' : 'Moonstone'} rolled ${d1Label}, ${d2Label}${rollNote}`,
        timestamp: Date.now(),
      },
    ],
  };
}

function applyMove(prev: GameState, move: Move): GameState {
  if (prev.phase !== 'moving') return prev;
  const newState = executeMove(prev, move);

  // Play sound effects based on what happened
  if (move.bearsOff) playHomeSound();
  else if (move.captures) playJailedSound();
  else if (move.crowns) playCrownedSound();

  const winner = checkWinCondition(newState);
  if (winner) {
    return { ...newState, winner, phase: 'game_over' };
  }
  return newState;
}

function applyJokerChoice(prev: GameState, value: number): GameState {
  if (!prev.dice.pendingDoubleJoker || prev.dice.remaining.length > 0) return prev;
  const newState: GameState = {
    ...prev,
    dice: { ...prev.dice, remaining: [value, value, value, value], pendingDoubleJoker: false },
    moveLog: [
      ...prev.moveLog,
      {
        turn: prev.turnCount,
        player: prev.currentPlayer,
        action: `${GAME_CONFIG.PLAYER_NAMES[prev.currentPlayer]} chose doubles of ${value}`,
        timestamp: Date.now(),
      },
    ],
  };
  if (!canPlayerMove(newState)) {
    return {
      ...newState,
      currentPlayer: newState.currentPlayer === 1 ? 2 : 1,
      dice: { values: newState.dice.values, remaining: [], hasRolled: false, pendingDoubleJoker: false },
      phase: 'rolling',
      turnCount: newState.turnCount + 1,
    };
  }
  return newState;
}

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState);
  const undoStack = useRef<GameState[]>([]);
  const aiTimerRef = useRef<number | null>(null);

  const isAITurn = state.gameMode === 'ai' && state.currentPlayer === 2 && state.phase !== 'not_started' && state.phase !== 'game_over';

  // ── Human actions ──

  const startGame = useCallback((mode: GameMode, difficulty: AIDifficulty) => {
    setState(prev => ({ ...prev, phase: 'rolling', gameMode: mode, aiDifficulty: difficulty }));
  }, []);

  const roll = useCallback(() => {
    if (isAITurn) return; // Block human from rolling during AI turn
    undoStack.current = [];
    setState(applyRoll);
  }, [isAITurn]);

  const selectMove = useCallback((move: Move) => {
    if (isAITurn) return;
    setState(prev => {
      if (prev.phase !== 'moving') return prev;
      undoStack.current.push(JSON.parse(JSON.stringify(prev)));
      const newState = applyMove(prev, move);
      if (newState.currentPlayer !== prev.currentPlayer) undoStack.current = [];
      return newState;
    });
  }, [isAITurn]);

  const undo = useCallback(() => {
    if (isAITurn) return;
    if (undoStack.current.length === 0) return;
    setState(undoStack.current.pop()!);
  }, [isAITurn]);

  const restart = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    undoStack.current = [];
    setState(createInitialState());
  }, []);

  const chooseJokerDoubles = useCallback((value: number) => {
    if (isAITurn) return;
    setState(prev => applyJokerChoice(prev, value));
  }, [isAITurn]);

  // ── AI auto-play ──

  useEffect(() => {
    if (!isAITurn) return;

    const delay = (ms: number) => new Promise<void>(resolve => {
      aiTimerRef.current = window.setTimeout(resolve, ms);
    });

    let cancelled = false;

    const playAITurn = async () => {
      // Rolling phase
      if (state.phase === 'rolling') {
        await delay(2000);
        if (cancelled) return;
        setState(applyRoll);
        return;
      }

      // Moving phase
      if (state.phase === 'moving') {
        // Handle Joker doubles choice
        const awaitingChoice = state.dice.pendingDoubleJoker && state.dice.remaining.length === 0;
        if (awaitingChoice) {
          await delay(2000);
          if (cancelled) return;
          const value = chooseBestJokerValue(state, state.aiDifficulty);
          setState(prev => applyJokerChoice(prev, value));
          return;
        }

        // Compute valid moves
        const allMoves = computeValidMoves(state);
        if (allMoves.length === 0) return;

        // Pick and execute a move
        await delay(2500);
        if (cancelled) return;
        const bestMove = chooseBestMove(state, allMoves, state.aiDifficulty);
        if (bestMove) {
          setState(prev => applyMove(prev, bestMove));
        }
      }
    };

    playAITurn();

    return () => {
      cancelled = true;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [state.phase, state.currentPlayer, state.dice.remaining.length, state.gameMode, isAITurn, state.dice.pendingDoubleJoker, state.turnCount]);

  // ── Computed values ──

  const awaitingJokerChoice = state.dice.pendingDoubleJoker && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = useMemo(() => computeValidMoves(state, awaitingJokerChoice), [state, awaitingJokerChoice]);

  const canUndo = undoStack.current.length > 0 && state.phase === 'moving' && !isAITurn;

  return {
    state, roll, selectMove, restart, validMoves,
    awaitingJokerChoice, chooseJokerDoubles,
    undo, canUndo, startGame, isAITurn,
  };
}

function computeValidMoves(state: GameState, awaitingJokerChoice?: boolean): Move[] {
  if (state.phase !== 'moving') return [];
  if (awaitingJokerChoice) return [];
  const seen = new Set<string>();
  const moves: Move[] = [];

  for (const dv of state.dice.remaining) {
    for (const m of getValidMoves(state, dv)) {
      const key = `${m.pieceId}:${m.to.type === 'home' ? 'home' : m.to.index}:${m.diceValue}:${m.diceCount}`;
      if (!seen.has(key)) { seen.add(key); moves.push(m); }
    }
  }

  for (const m of getMultiStepMoves(state)) {
    const key = `${m.pieceId}:${m.to.type === 'home' ? 'home' : m.to.index}:${m.diceValue}:${m.diceCount}`;
    if (!seen.has(key)) { seen.add(key); moves.push(m); }
  }

  return moves;
}
