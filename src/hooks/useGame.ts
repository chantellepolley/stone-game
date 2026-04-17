import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GameState, GamePhase, Move, GameMode, AIDifficulty } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { recordGameResult } from '../lib/statsTracker';
import { isJester } from '../engine/dice';
import { chooseBestMove, chooseBestJesterValue } from '../engine/ai';
import { GAME_CONFIG } from '../config/gameConfig';
import { playCrownedSound, playHomeSound, playJailedSound } from '../utils/sounds';
import { supabase } from '../lib/supabase';

function applyRoll(prev: GameState): GameState {
  if (prev.phase !== 'rolling') return prev;
  const dice = rollDice();
  const newState: GameState = { ...prev, dice, phase: 'moving' };

  if (!canPlayerMove(newState)) {
    // Keep dice visible (hasRolled: true) so the roll is shown briefly
    return {
      ...newState,
      dice: { ...dice, remaining: [], hasRolled: true },
      phase: 'no_moves' as GamePhase, // temporary phase — will auto-switch
      moveLog: [
        ...newState.moveLog,
        {
          turn: newState.turnCount,
          player: newState.currentPlayer,
          action: `${newState.currentPlayer === 1 ? 'Sunstone' : 'Moonstone'} rolled ${isJester(dice.values[0]) ? 'Jester' : dice.values[0]}, ${isJester(dice.values[1]) ? 'Jester' : dice.values[1]} — no valid moves`,
          timestamp: Date.now(),
        },
      ],
    };
  }

  const d1Jester = isJester(dice.values[0]);
  const d2Jester = isJester(dice.values[1]);
  const d1Label = d1Jester ? 'Jester' : String(dice.values[0]);
  const d2Label = d2Jester ? 'Jester' : String(dice.values[1]);
  let rollNote = '';
  if (d1Jester && d2Jester) {
    rollNote = ' — Double Jesters! Move 1 & 2, then choose doubles';
  } else if (d1Jester || d2Jester) {
    const normalVal = d1Jester ? dice.values[1] : dice.values[0];
    rollNote = ` — Jester! 4x${normalVal}`;
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

  // Play sound effects — check for intermediate captures too
  const opponent = prev.currentPlayer === 1 ? 2 : 1;
  const prevJailCount = prev.jail[opponent as 1 | 2].length;
  const newJailCount = newState.jail[opponent as 1 | 2].length;
  const anyCaptured = newJailCount > prevJailCount;

  if (move.bearsOff) playHomeSound();
  else if (anyCaptured) playJailedSound();
  else if (move.crowns) playCrownedSound();


  const winner = checkWinCondition(newState);
  if (winner) {
    return { ...newState, winner, phase: 'game_over' };
  }
  return newState;
}

function applyJesterChoice(prev: GameState, value: number): GameState {
  if (!prev.dice.pendingDoubleJester || prev.dice.remaining.length > 0) return prev;
  const newState: GameState = {
    ...prev,
    dice: { ...prev.dice, remaining: [value, value, value, value], pendingDoubleJester: false },
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
      dice: { values: newState.dice.values, remaining: [], hasRolled: false, pendingDoubleJester: false },
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
  const [pendingAIMove, setPendingAIMove] = useState<Move | null>(null);
  const [aiRolling, setAiRolling] = useState(false);
  const gameDbId = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const isAITurn = state.gameMode === 'ai' && state.currentPlayer === 2 && state.phase !== 'not_started' && state.phase !== 'game_over' && state.phase !== 'no_moves';
  const statsRecorded = useRef(false);

  // ── Helper: get current player's DB id ──
  async function getMyPlayerId(): Promise<string | null> {
    const token = localStorage.getItem('stone_device_token');
    if (!token) { console.warn('[STONE] No device token'); return null; }
    const { data, error } = await supabase.from('players').select('id').eq('device_token', token).single();
    if (error) { console.warn('[STONE] getMyPlayerId error:', error.message); return null; }
    return data?.id || null;
  }

  // ── Auto-save state to DB (debounced) ──
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Save whenever game is active — even if gameDbId isn't set yet (will save on next change)
    if (state.phase === 'not_started' || state.phase === 'game_over') return;
    if (!gameDbId.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!gameDbId.current) return;
      supabase.from('games').update({
        state: stateRef.current,
        status: stateRef.current.phase === 'game_over' ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', gameDbId.current).then(({ error }) => {
        if (error) console.error('[STONE] Auto-save failed:', error.message);
      });
    }, 1000);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state]);

  // ── Record stats when game ends ──
  useEffect(() => {
    if (state.phase === 'game_over' && state.winner && !statsRecorded.current) {
      statsRecorded.current = true;
      getMyPlayerId().then(playerId => {
        if (playerId) {
          recordGameResult(state, state.winner!, playerId, null);

          // Mark game completed in DB + set winner
          if (gameDbId.current) {
            supabase.from('games').update({
              state,
              status: 'completed',
              winner_id: state.winner === 1 ? playerId : null,
              updated_at: new Date().toISOString(),
            }).eq('id', gameDbId.current).then(() => {});
          }
        }
      });
    }
    if (state.phase === 'not_started') statsRecorded.current = false;
  }, [state.phase, state.winner]);

  // ── Auto-switch after "no valid moves" display ──
  useEffect(() => {
    if (state.phase !== 'no_moves') return;
    const timer = setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentPlayer: prev.currentPlayer === 1 ? 2 : 1,
        dice: { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJester: false },
        phase: 'rolling',
        turnCount: prev.turnCount + 1,
      }));
    }, 2500); // Show the roll for 2.5 seconds
    return () => clearTimeout(timer);
  }, [state.phase]);

  // ── Human actions ──

  // Track pending DB creation so auto-save waits for it
  const dbCreatePending = useRef(false);

  const startGame = useCallback((mode: GameMode, difficulty: AIDifficulty) => {
    const newState: GameState = { ...createInitialState(), phase: 'rolling', gameMode: mode, aiDifficulty: difficulty };
    setState(newState);
    statsRecorded.current = false;
    gameDbId.current = null;
    dbCreatePending.current = true;

    // Fire-and-forget DB insert — don't block the game starting
    (async () => {
      try {
        const playerId = await getMyPlayerId();
        if (!playerId) {
          console.warn('[STONE] Cannot save game: no player ID');
          dbCreatePending.current = false;
          return;
        }
        const dbMode = mode === 'ai' ? 'ai' : 'local';
        const code = `${dbMode.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const { data, error } = await supabase.from('games').insert({
          room_code: code,
          player1_id: playerId,
          mode: dbMode,
          state: stateRef.current, // use ref to get latest state (game may have progressed)
          status: 'active',
        }).select('id').single();

        if (error) {
          console.error('[STONE] Failed to create game in DB:', error.message);
        } else if (data) {
          console.log('[STONE] Game saved to DB:', data.id);
          gameDbId.current = data.id;
        }
      } catch (e) {
        console.error('[STONE] startGame DB error:', e);
      } finally {
        dbCreatePending.current = false;
      }
    })();
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
    gameDbId.current = null;
    setState(createInitialState());
  }, []);

  const loadGame = useCallback(async (dbGameId: string) => {
    const { data } = await supabase
      .from('games')
      .select('state')
      .eq('id', dbGameId)
      .single();
    if (data?.state) {
      const loaded = data.state as GameState;
      gameDbId.current = dbGameId;
      statsRecorded.current = false;
      undoStack.current = [];
      setState(loaded);
    }
  }, []);

  const chooseJesterDoubles = useCallback((value: number) => {
    if (isAITurn) return;
    setState(prev => applyJesterChoice(prev, value));
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
        await delay(1000);
        if (cancelled) return;
        setAiRolling(true); // Start dice animation
        await delay(1200);  // Let animation play
        if (cancelled) return;
        setAiRolling(false);
        setState(applyRoll);
        return;
      }

      // Moving phase
      if (state.phase === 'moving') {
        // Handle Jester doubles choice
        const awaitingChoice = state.dice.pendingDoubleJester && state.dice.remaining.length === 0;
        if (awaitingChoice) {
          await delay(2000);
          if (cancelled) return;
          const value = chooseBestJesterValue(state, state.aiDifficulty);
          setState(prev => applyJesterChoice(prev, value));
          return;
        }

        // Compute valid moves
        const allMoves = computeValidMoves(state);
        if (allMoves.length === 0) return;

        // Pick move, show animation, then execute
        await delay(1500);
        if (cancelled) return;
        const bestMove = chooseBestMove(state, allMoves, state.aiDifficulty);
        if (bestMove) {
          setPendingAIMove(bestMove);        // Board will animate this
          await delay(500);                  // Wait for animation
          if (cancelled) return;
          setPendingAIMove(null);
          setState(prev => applyMove(prev, bestMove));
        }
      }
    };

    playAITurn();

    return () => {
      cancelled = true;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [state.phase, state.currentPlayer, state.dice.remaining.length, state.gameMode, isAITurn, state.dice.pendingDoubleJester, state.turnCount]);

  // ── Computed values ──

  const awaitingJesterChoice = state.dice.pendingDoubleJester && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = useMemo(() => computeValidMoves(state, awaitingJesterChoice), [state, awaitingJesterChoice]);

  const canUndo = undoStack.current.length > 0 && state.phase === 'moving' && !isAITurn;

  return {
    state, roll, selectMove, restart, validMoves,
    awaitingJesterChoice, chooseJesterDoubles,
    undo, canUndo, startGame, isAITurn, pendingAIMove, aiRolling,
    loadGame,
  };
}

function computeValidMoves(state: GameState, awaitingJesterChoice?: boolean): Move[] {
  if (state.phase !== 'moving') return [];
  if (awaitingJesterChoice) return [];
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
