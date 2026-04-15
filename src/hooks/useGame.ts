import { useState, useCallback, useMemo, useRef } from 'react';
import type { GameState, Move } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJoker } from '../engine/dice';
import { GAME_CONFIG } from '../config/gameConfig';

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState);
  const undoStack = useRef<GameState[]>([]);

  const roll = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'rolling') return prev;
      undoStack.current = []; // Clear undo stack on new roll

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
    });
  }, []);

  const selectMove = useCallback((move: Move) => {
    setState(prev => {
      if (prev.phase !== 'moving') return prev;
      // Save state before the move for undo
      undoStack.current.push(JSON.parse(JSON.stringify(prev)));
      const newState = executeMove(prev, move);
      const winner = checkWinCondition(newState);
      if (winner) {
        undoStack.current = []; // No undo after winning
        return { ...newState, winner, phase: 'game_over' };
      }
      // If turn switched, clear undo stack (can't undo into other player's turn)
      if (newState.currentPlayer !== prev.currentPlayer) {
        undoStack.current = [];
      }
      return newState;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prevState = undoStack.current.pop()!;
    setState(prevState);
  }, []);

  const restart = useCallback(() => {
    undoStack.current = [];
    setState(createInitialState());
  }, []);

  const chooseJokerDoubles = useCallback((value: number) => {
    setState(prev => {
      if (!prev.dice.pendingDoubleJoker || prev.dice.remaining.length > 0) return prev;
      const newState: GameState = {
        ...prev,
        dice: {
          ...prev.dice,
          remaining: [value, value, value, value],
          pendingDoubleJoker: false,
        },
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
    });
  }, []);

  const awaitingJokerChoice = state.dice.pendingDoubleJoker && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = useMemo(() => {
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
  }, [state, awaitingJokerChoice]);

  const canUndo = undoStack.current.length > 0 && state.phase === 'moving';

  return { state, roll, selectMove, restart, validMoves, awaitingJokerChoice, chooseJokerDoubles, undo, canUndo };
}
