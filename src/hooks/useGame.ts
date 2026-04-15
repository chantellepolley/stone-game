import { useReducer, useCallback, useMemo } from 'react';
import type { GameState, GameAction, Move } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJoker } from '../engine/dice';
import { GAME_CONFIG } from '../config/gameConfig';

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROLL_DICE': {
      if (state.phase !== 'rolling') return state;
      const dice = rollDice();
      const newState: GameState = { ...state, dice, phase: 'moving' };

      // Check if any valid moves exist
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

      // Log the roll
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

    case 'SELECT_MOVE': {
      if (state.phase !== 'moving') return state;
      const newState = executeMove(state, action.move);
      const winner = checkWinCondition(newState);
      if (winner) {
        return { ...newState, winner, phase: 'game_over' };
      }
      return newState;
    }

    case 'CHOOSE_JOKER_DOUBLES': {
      if (!state.dice.pendingDoubleJoker || state.dice.remaining.length > 0) return state;
      const value = action.value;
      const newState: GameState = {
        ...state,
        dice: {
          ...state.dice,
          remaining: [value, value, value, value],
          pendingDoubleJoker: false,
        },
        moveLog: [
          ...state.moveLog,
          {
            turn: state.turnCount,
            player: state.currentPlayer,
            action: `${GAME_CONFIG.PLAYER_NAMES[state.currentPlayer]} chose doubles of ${value}`,
            timestamp: Date.now(),
          },
        ],
      };
      // Check if new doubles have valid moves
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

    case 'RESTART_GAME':
      return createInitialState();

    default:
      return state;
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  const roll = useCallback(() => dispatch({ type: 'ROLL_DICE' }), []);
  const selectMove = useCallback((move: Move) => dispatch({ type: 'SELECT_MOVE', move }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART_GAME' }), []);
  const chooseJokerDoubles = useCallback((value: number) => dispatch({ type: 'CHOOSE_JOKER_DOUBLES', value }), []);

  // Is the player currently choosing their double joker value?
  const awaitingJokerChoice = state.dice.pendingDoubleJoker && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = useMemo(() => {
    if (state.phase !== 'moving') return [];
    if (awaitingJokerChoice) return []; // No board moves while choosing
    const seen = new Set<string>();
    const moves: Move[] = [];

    for (const dv of state.dice.remaining) {
      for (const m of getValidMoves(state, dv)) {
        const key = `${m.pieceId}:${m.to.type === 'home' ? 'home' : m.to.index}:${m.diceValue}:${m.diceCount}`;
        if (!seen.has(key)) {
          seen.add(key);
          moves.push(m);
        }
      }
    }

    for (const m of getMultiStepMoves(state)) {
      const key = `${m.pieceId}:${m.to.type === 'home' ? 'home' : m.to.index}:${m.diceValue}:${m.diceCount}`;
      if (!seen.has(key)) {
        seen.add(key);
        moves.push(m);
      }
    }

    return moves;
  }, [state, awaitingJokerChoice]);

  return { state, roll, selectMove, restart, validMoves, awaitingJokerChoice, chooseJokerDoubles };
}
