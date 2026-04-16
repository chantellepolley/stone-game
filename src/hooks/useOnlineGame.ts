import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, GamePhase, Move, PlayerId } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJoker } from '../engine/dice';
import { GAME_CONFIG } from '../config/gameConfig';
import { supabase } from '../lib/supabase';
import { playCrownedSound, playHomeSound, playJailedSound } from '../utils/sounds';
import type { RealtimeChannel } from '@supabase/supabase-js';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

type OnlinePhase = 'idle' | 'waiting' | 'connecting' | 'playing' | 'error';

export function useOnlineGame() {
  const [state, setState] = useState<GameState>(() => {
    const s = createInitialState();
    return { ...s, phase: 'not_started' as GamePhase, gameMode: 'pvp' as const };
  });
  const [onlinePhase, setOnlinePhase] = useState<OnlinePhase>('idle');
  const [roomCode, setRoomCode] = useState('');
  const [myPlayer, setMyPlayer] = useState<PlayerId | null>(null);
  const [error, setError] = useState('');
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [pendingOpponentMove, setPendingOpponentMove] = useState<Move | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const undoStack = useRef<GameState[]>([]);
  const pingRef = useRef<number | null>(null);
  const stateReceivedRef = useRef(false);

  const isMyTurn = myPlayer !== null && state.currentPlayer === myPlayer && state.phase !== 'game_over' && state.phase !== 'not_started';

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  function joinChannel(code: string, player: PlayerId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (pingRef.current) clearInterval(pingRef.current);
    stateReceivedRef.current = false;

    const channel = supabase.channel(`stone-game-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'state_update' }, ({ payload }) => {
        if (payload.move) {
          const move = payload.move as Move;
          if (move.bearsOff) playHomeSound();
          else if (move.captures) playJailedSound();
          else if (move.crowns) playCrownedSound();
          setPendingOpponentMove(move);
          setTimeout(() => {
            setPendingOpponentMove(null);
            if (payload.state) setState(payload.state as GameState);
          }, 500);
        } else if (payload.state) {
          setState(payload.state as GameState);
        }
        // Mark that we've received state — game is live
        if (!stateReceivedRef.current) {
          stateReceivedRef.current = true;
          setOnlinePhase('playing');
          setOpponentConnected(true);
        }
      })
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        // Opponent is alive
        setOpponentConnected(true);
        if (payload.needState && player === 1) {
          // Guest is requesting state — send it
          channel.send({ type: 'broadcast', event: 'state_update', payload: { state } });
        }
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        setOpponentConnected(true);
        if (player === 1) {
          // Host: send state immediately and switch to playing
          setOnlinePhase('playing');
          setTimeout(() => {
            channel.send({ type: 'broadcast', event: 'state_update', payload: { state } });
          }, 200);
        }
      })
      .on('broadcast', { event: 'player_left' }, () => {
        setOpponentConnected(false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (player === 2) {
            // Guest: announce join, then ping repeatedly until state is received
            await channel.send({ type: 'broadcast', event: 'player_joined', payload: {} });

            // Retry join announcement and request state every 1.5s
            let retries = 0;
            const retryInterval = setInterval(async () => {
              if (stateReceivedRef.current) {
                clearInterval(retryInterval);
                return;
              }
              retries++;
              if (retries > 7) {
                // ~10 seconds with no response — game doesn't exist
                clearInterval(retryInterval);
                setOnlinePhase('error');
                setError('Game not found or host has left. Try a different code.');
                return;
              }
              await channel.send({ type: 'broadcast', event: 'player_joined', payload: {} });
              await channel.send({ type: 'broadcast', event: 'ping', payload: { needState: true } });
            }, 1500);
          }

          // Both sides: periodic ping to maintain connection awareness
          pingRef.current = window.setInterval(() => {
            channel.send({ type: 'broadcast', event: 'ping', payload: { needState: false } });
          }, 5000);
        }
      });

    channelRef.current = channel;
  }

  function broadcastState(newState: GameState, move?: Move) {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'state_update',
        payload: { state: newState, move: move || null },
      });
    }
  }

  // ── Actions ──

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMyPlayer(1);
    setOnlinePhase('waiting');
    const initialState: GameState = {
      ...createInitialState(),
      phase: 'rolling',
      gameMode: 'pvp',
    };
    setState(initialState);
    joinChannel(code, 1);
  }, []);

  const joinRoom = useCallback((code: string) => {
    const upperCode = code.toUpperCase().trim();
    if (upperCode.length < 4) {
      setError('Code must be at least 4 characters');
      return;
    }
    setRoomCode(upperCode);
    setMyPlayer(2);
    setOnlinePhase('connecting'); // Show "Connecting..." not "playing"
    joinChannel(upperCode, 2);
  }, []);

  const roll = useCallback(() => {
    if (!isMyTurn || state.phase !== 'rolling') return;
    undoStack.current = [];

    const dice = rollDice();
    let newState: GameState = { ...state, dice, phase: 'moving' };

    if (!canPlayerMove(newState)) {
      newState = {
        ...newState,
        dice: { ...dice, remaining: [], hasRolled: true },
        phase: 'no_moves' as GamePhase,
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
      setState(newState);
      broadcastState(newState);
      setTimeout(() => {
        setState(prev => {
          if (prev.phase !== 'no_moves') return prev;
          const switched: GameState = {
            ...prev,
            currentPlayer: prev.currentPlayer === 1 ? 2 : 1,
            dice: { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJoker: false },
            phase: 'rolling',
            turnCount: prev.turnCount + 1,
          };
          broadcastState(switched);
          return switched;
        });
      }, 2500);
      return;
    } else {
      const d1J = isJoker(dice.values[0]), d2J = isJoker(dice.values[1]);
      let note = '';
      if (d1J && d2J) note = ' — Double Jokers! Move 1 & 2, then choose doubles';
      else if (d1J || d2J) note = ` — Joker! 4x${d1J ? dice.values[1] : dice.values[0]}`;
      else if (dice.values[0] === dice.values[1]) note = ' (doubles!)';

      newState = {
        ...newState,
        moveLog: [
          ...newState.moveLog,
          {
            turn: newState.turnCount,
            player: newState.currentPlayer,
            action: `${GAME_CONFIG.PLAYER_NAMES[newState.currentPlayer]} rolled ${d1J ? 'Joker' : dice.values[0]}, ${d2J ? 'Joker' : dice.values[1]}${note}`,
            timestamp: Date.now(),
          },
        ],
      };
    }

    setState(newState);
    broadcastState(newState);
  }, [isMyTurn, state]);

  const selectMove = useCallback((move: Move) => {
    if (!isMyTurn || state.phase !== 'moving') return;
    undoStack.current.push(JSON.parse(JSON.stringify(state)));

    if (move.bearsOff) playHomeSound();
    else if (move.captures) playJailedSound();
    else if (move.crowns) playCrownedSound();

    let newState = executeMove(state, move);
    const winner = checkWinCondition(newState);
    if (winner) newState = { ...newState, winner, phase: 'game_over' };
    if (newState.currentPlayer !== state.currentPlayer) undoStack.current = [];

    setState(newState);
    broadcastState(newState, move);
  }, [isMyTurn, state]);

  const chooseJokerDoubles = useCallback((value: number) => {
    if (!isMyTurn) return;
    if (!state.dice.pendingDoubleJoker || state.dice.remaining.length > 0) return;

    let newState: GameState = {
      ...state,
      dice: { ...state.dice, remaining: [value, value, value, value], pendingDoubleJoker: false },
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

    if (!canPlayerMove(newState)) {
      newState = {
        ...newState,
        currentPlayer: newState.currentPlayer === 1 ? 2 : 1,
        dice: { values: newState.dice.values, remaining: [], hasRolled: false, pendingDoubleJoker: false },
        phase: 'rolling',
        turnCount: newState.turnCount + 1,
      };
    }

    setState(newState);
    broadcastState(newState);
  }, [isMyTurn, state]);

  const undo = useCallback(() => {
    if (!isMyTurn || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setState(prev);
    broadcastState(prev);
  }, [isMyTurn]);

  const leave = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'player_left', payload: {} });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pingRef.current) clearInterval(pingRef.current);
    setOnlinePhase('idle');
    setMyPlayer(null);
    setOpponentConnected(false);
    setRoomCode('');
    stateReceivedRef.current = false;
    setState(() => {
      const s = createInitialState();
      return { ...s, phase: 'not_started' as GamePhase, gameMode: 'pvp' as const };
    });
  }, []);

  const awaitingJokerChoice = state.dice.pendingDoubleJoker && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = (() => {
    if (state.phase !== 'moving' || !isMyTurn) return [];
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
  })();

  const canUndo = undoStack.current.length > 0 && isMyTurn && state.phase === 'moving';

  return {
    state, roll, selectMove, undo, canUndo, validMoves,
    awaitingJokerChoice, chooseJokerDoubles,
    onlinePhase, roomCode, myPlayer, opponentConnected, error,
    createRoom, joinRoom, leave,
    isMyTurn, pendingOpponentMove,
  };
}
