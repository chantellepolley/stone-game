import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { GameState, GamePhase, Move, PlayerId } from '../types/game';
import { createInitialState, rollDice, getValidMoves, getMultiStepMoves, executeMove, canPlayerMove, checkWinCondition } from '../engine';
import { isJester } from '../engine/dice';
import { GAME_CONFIG } from '../config/gameConfig';
import { supabase } from '../lib/supabase';
import { playCrownedSound, playHomeSound, playJailedSound } from '../utils/sounds';
import { recordGameResult } from '../lib/statsTracker';
import { loadPlayerColor } from '../utils/stoneColors';
import { sendPushNotification } from './usePushNotifications';
import { deductCoins } from '../lib/coins';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Validate and repair a game state loaded from DB */
function validateState(raw: any): GameState {
  // If critical fields are missing, create a fresh state
  if (!raw || !raw.board || !raw.bench || !raw.jail || !raw.home || !raw.dice) {
    return { ...createInitialState(), phase: 'rolling' as GamePhase, gameMode: 'pvp' as const };
  }
  const s = raw as GameState;
  if (!s.captureCount) s.captureCount = { 1: 0, 2: 0 };
  if (!s.moveLog) s.moveLog = [];
  return s;
}

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
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentColor, setOpponentColor] = useState<string | null>(null);
  const [pendingOpponentMove, setPendingOpponentMove] = useState<Move | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; text: string; timestamp: number; isMine: boolean; avatarUrl?: string | null }>>([]);
  const [gameWager, setGameWager] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const undoStack = useRef<GameState[]>([]);
  const pingRef = useRef<number | null>(null);
  const stateReceivedRef = useRef(false);
  const gameDbId = useRef<string | null>(null);
  const statsRecorded = useRef(false);
  // Always-current state ref so broadcast handlers don't use stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const myUsernameRef = useRef<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('stone_device_token');
    if (token) {
      supabase.from('players').select('username').eq('device_token', token).single()
        .then(({ data }) => { if (data) myUsernameRef.current = data.username; });
    }
  }, []);

  const isMyTurn = myPlayer !== null && state.currentPlayer === myPlayer && state.phase !== 'game_over' && state.phase !== 'not_started';

  // Persist active game info to localStorage for recovery
  useEffect(() => {
    if (gameDbId.current && roomCode && myPlayer) {
      localStorage.setItem('stone_active_game', JSON.stringify({
        gameId: gameDbId.current, roomCode, myPlayer,
      }));
    }
  }, [roomCode, myPlayer]);

  useEffect(() => {
    // Don't auto-recover — let the user resume from My Games instead.
    // Auto-recovery was causing blank screens when old game data was stale.

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  // ── Reconnect when app comes back from background ──
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!gameDbId.current || !roomCode || myPlayer === null) return;

      // Reload state from DB — this is the source of truth
      const { data } = await supabase
        .from('games')
        .select('state, status')
        .eq('id', gameDbId.current)
        .single();

      if (data?.state) {
        const loadedState = validateState(data.state);
        setState(loadedState);
        stateRef.current = loadedState;
        // Ensure we're in playing phase if we have valid state
        if (loadedState.phase !== 'not_started') {
          stateReceivedRef.current = true;
          setOnlinePhase('playing');
        }
      }

      // Reconnect the channel if needed (preserve state since we loaded from DB)
      if (channelRef.current) {
        const channelStatus = channelRef.current.state;
        if (channelStatus !== 'joined' && channelStatus !== 'joining') {
          joinChannel(roomCode, myPlayer, true);
        }
      } else {
        joinChannel(roomCode, myPlayer, true);
      }

      // Announce we're back
      setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.send({ type: 'broadcast', event: 'player_joined', payload: {} });
        }
      }, 500);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [roomCode, myPlayer]);

  // ── Record stats when game ends ──
  useEffect(() => {
    if (state.phase === 'game_over' && state.winner && !statsRecorded.current) {
      statsRecorded.current = true;
      // Game is done — clear active game from localStorage
      localStorage.removeItem('stone_active_game');
      if (gameDbId.current) {
        (async () => {
          // Fetch game to check if already completed and get both player IDs
          const { data: game } = await supabase
            .from('games')
            .select('player1_id, player2_id, status')
            .eq('id', gameDbId.current!)
            .single();

          if (!game) return;

          const winnerDbId = state.winner === 1 ? game.player1_id : game.player2_id;

          // Update game status + record stats only if not already completed
          // This prevents double-recording when both clients are online
          if (game.status !== 'completed') {
            await supabase.from('games').update({
              status: 'completed',
              state,
              winner_id: winnerDbId,
              updated_at: new Date().toISOString(),
            }).eq('id', gameDbId.current!);

            // Record stats for both players
            recordGameResult(state, state.winner!, game.player1_id, game.player2_id);
          }
        })();
      }
    }
  }, [state.phase, state.winner, myPlayer]);

  async function getMyPlayerId(): Promise<string | null> {
    const token = localStorage.getItem('stone_device_token');
    if (!token) {
      console.warn('[STONE] No device token in localStorage');
      return null;
    }
    const { data, error } = await supabase.from('players').select('id').eq('device_token', token).single();
    if (error) {
      console.warn('[STONE] Failed to get player ID:', error.message);
      return null;
    }
    return data?.id || null;
  }

  // ── Save state to DB on every change ──
  async function saveGameState(newState: GameState) {
    if (!gameDbId.current) return;
    await supabase.from('games').update({
      state: newState,
      updated_at: new Date().toISOString(),
    }).eq('id', gameDbId.current);
  }

  function joinChannel(code: string, player: PlayerId, preserveStateReceived = false) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (pingRef.current) clearInterval(pingRef.current);
    if (!preserveStateReceived) stateReceivedRef.current = false;

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
            if (payload.state) {
              const s = payload.state as GameState;
              setState(s);
              stateRef.current = s;
            }
          }, 500);
        } else if (payload.state) {
          const s = payload.state as GameState;
          setState(s);
          stateRef.current = s;
        }
        if (!stateReceivedRef.current) {
          stateReceivedRef.current = true;
          setOnlinePhase('playing');
          setOpponentConnected(true);
        }
      })
      .on('broadcast', { event: 'ping' }, ({ payload }) => {
        setOpponentConnected(true);
        if (payload?.color) setOpponentColor(payload.color);
        if (payload.needState && player === 1) {
          channel.send({ type: 'broadcast', event: 'state_update', payload: { state: stateRef.current } });
        }
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        setOpponentConnected(true);
        if (payload?.color) setOpponentColor(payload.color);
        if (player === 1) {
          setOnlinePhase('playing');
          setTimeout(() => {
            channel.send({ type: 'broadcast', event: 'state_update', payload: { state: stateRef.current } });
            // Send our color to the opponent
            channel.send({ type: 'broadcast', event: 'player_joined', payload: { color: loadPlayerColor() } });
          }, 200);
        }
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload?.text && payload?.sender) {
          setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: payload.sender,
            text: payload.text,
            timestamp: payload.timestamp || Date.now(),
            isMine: false,
            avatarUrl: payload.avatarUrl || null,
          }]);
        }
      })
      .on('broadcast', { event: 'player_left' }, () => {
        setOpponentConnected(false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (player === 2) {
            await channel.send({ type: 'broadcast', event: 'player_joined', payload: { color: loadPlayerColor() } });
            let retries = 0;
            const retryInterval = setInterval(async () => {
              if (stateReceivedRef.current) { clearInterval(retryInterval); return; }
              retries++;
              if (retries > 5) {
                clearInterval(retryInterval);
                // Host isn't responding — try loading state from DB as fallback
                if (gameDbId.current) {
                  const { data: fallback } = await supabase
                    .from('games')
                    .select('state')
                    .eq('id', gameDbId.current)
                    .single();
                  if (fallback?.state) {
                    const loadedState = validateState(fallback.state);
                    setState(loadedState);
                    stateRef.current = loadedState;
                    stateReceivedRef.current = true;
                    setOnlinePhase('playing');
                    return;
                  }
                }
                setOnlinePhase('error');
                setError('Could not connect to this game. Try resuming from My Games.');
                return;
              }
              await channel.send({ type: 'broadcast', event: 'player_joined', payload: { color: loadPlayerColor() } });
              await channel.send({ type: 'broadcast', event: 'ping', payload: { needState: true } });
            }, 1500);
          }
          pingRef.current = window.setInterval(() => {
            channel.send({ type: 'broadcast', event: 'ping', payload: { needState: false, color: loadPlayerColor() } });
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
    // Save to DB
    saveGameState(newState);

    // Send push notification to opponent when turn changes
    if (gameDbId.current && newState.currentPlayer !== stateRef.current.currentPlayer && newState.phase !== 'game_over') {
      notifyOpponentTurn(newState);
    }
    // Send push for game over
    if (newState.phase === 'game_over' && newState.winner) {
      notifyGameOver(newState);
    }
  }

  async function notifyOpponentTurn(newState: GameState) {
    if (!gameDbId.current) return;
    try {
      const { data: game } = await supabase
        .from('games')
        .select('player1_id, player2_id, room_code')
        .eq('id', gameDbId.current)
        .single();
      if (!game) return;
      // The new current player is the one who needs to be notified
      const targetId = newState.currentPlayer === 1 ? game.player1_id : game.player2_id;
      if (targetId) {
        const senderName = myUsernameRef.current || 'Your opponent';
        sendPushNotification(
          targetId,
          'STONE - Your Turn!',
          `${senderName} made their move. It's your turn!`,
          'your-turn',
          `/join/${game.room_code}`
        );
      }
    } catch { /* silent */ }
  }

  async function notifyGameOver(newState: GameState) {
    if (!gameDbId.current || !newState.winner) return;
    try {
      const { data: game } = await supabase
        .from('games')
        .select('player1_id, player2_id, room_code')
        .eq('id', gameDbId.current)
        .single();
      if (!game) return;
      // Notify the loser
      const loserId = newState.winner === 1 ? game.player2_id : game.player1_id;
      if (loserId) {
        const winnerName = myUsernameRef.current || 'Your opponent';
        sendPushNotification(
          loserId,
          'STONE - Game Over!',
          `${winnerName} won the game!`,
          'game-over',
          `/join/${game.room_code}`
        );
      }
    } catch { /* silent */ }
  }

  // ── Actions ──

  const createRoom = useCallback(async (wager = 0) => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMyPlayer(1);
    setOnlinePhase('waiting');
    setGameWager(wager);
    statsRecorded.current = false;

    const initialState: GameState = {
      ...createInitialState(),
      phase: 'rolling',
      gameMode: 'pvp',
    };
    setState(initialState);

    // Save game to DB
    const myId = await getMyPlayerId();
    const { data } = await supabase.from('games').insert({
      room_code: code,
      player1_id: myId,
      mode: 'online',
      state: initialState,
      status: 'waiting',
      wager,
      p1_color: loadPlayerColor(),
    }).select('id').single();

    if (data) gameDbId.current = data.id;

    joinChannel(code, 1);
  }, []);

  const joinRoom = useCallback(async (code: string) => {
    const upperCode = code.toUpperCase().trim();
    if (upperCode.length < 4) {
      setError('Code must be at least 4 characters');
      return;
    }
    setRoomCode(upperCode);
    setMyPlayer(2);
    setOnlinePhase('connecting');
    statsRecorded.current = false;

    // Find game in DB and join
    const myId = await getMyPlayerId();

    const { data: game } = await supabase
      .from('games')
      .select('id, state, player1_id, player2_id, wager, p1_color, p2_color')
      .eq('room_code', upperCode)
      .in('status', ['waiting', 'active'])
      .maybeSingle();

    if (game?.wager) setGameWager(game.wager);

    if (game) {
      gameDbId.current = game.id;

      // Check if we're already player 1 in this game — if so, resume as P1 instead
      let playerId = myId;
      if (!playerId) {
        for (let attempt = 0; attempt < 3 && !playerId; attempt++) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          playerId = await getMyPlayerId();
        }
      }

      if (playerId && game.player1_id === playerId) {
        // We're player 1 — resume as P1, don't overwrite player2
        setMyPlayer(1);
        if (game.state) {
          const loadedState = validateState(game.state);
          setState(loadedState);
          stateRef.current = loadedState;
          stateReceivedRef.current = true;
          setOnlinePhase('playing');
        }
        // Fetch opponent (P2) name
        const { data: gameData } = await supabase
          .from('games')
          .select('player2_id')
          .eq('id', game.id)
          .single();
        if (gameData?.player2_id) {
          const { data: opp } = await supabase.from('players').select('username').eq('id', gameData.player2_id).single();
          if (opp) setOpponentName(opp.username);
        }
        localStorage.setItem('stone_active_game', JSON.stringify({
          gameId: game.id, roomCode: upperCode, myPlayer: 1,
        }));
        joinChannel(upperCode, 1, true);
        setTimeout(() => {
          if (channelRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'player_joined', payload: {} });
          }
        }, 500);
        return;
      }

      if (playerId) {
        const isFirstJoin = !game.player2_id || game.player2_id !== playerId;

        if (isFirstJoin) {
          await supabase.from('games').update({
            player2_id: playerId,
            status: 'active',
            p2_color: loadPlayerColor(),
            updated_at: new Date().toISOString(),
          }).eq('id', game.id);

          // Deduct wager once on first join only
          if (game.wager && game.wager > 0) {
            await deductCoins(playerId, game.wager, 'Online game wager');
          }
        }

        // Persist active game so it appears in My Games even after navigating away
        localStorage.setItem('stone_active_game', JSON.stringify({
          gameId: game.id, roomCode: upperCode, myPlayer: 2,
        }));
      }

      // Load saved state from DB so we have it ready
      if (game.state) {
        const loadedState = validateState(game.state);
        setState(loadedState);
        stateRef.current = loadedState;
        // Mark state as received so the channel retry won't error out
        stateReceivedRef.current = true;
        // Go straight to playing — we have valid state from DB
        setOnlinePhase('playing');
      }

      // Load chat from DB
      const { data: chatData } = await supabase
        .from('games')
        .select('chat')
        .eq('id', game.id)
        .single();
      if (chatData?.chat && Array.isArray(chatData.chat)) {
        const loadedMsgs = (chatData.chat as Array<{ sender: string; text: string; timestamp: number; avatarUrl?: string | null }>).map((m, i) => ({
          id: `db-${i}-${m.timestamp}`,
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp,
          isMine: m.sender === myUsernameRef.current,
          avatarUrl: m.avatarUrl || null,
        }));
        if (loadedMsgs.length > 0) setChatMessages(loadedMsgs);
      }
    }

    // Fetch opponent (P1) name and load color from DB
    if (game?.player1_id) {
      supabase.from('players').select('username').eq('id', game.player1_id).single()
        .then(({ data: p }) => { if (p) setOpponentName(p.username); });
    }
    if (game?.p1_color) setOpponentColor(game.p1_color);

    // Always connect to the channel even if game not in DB yet
    // preserveStateReceived if we already loaded state from DB
    joinChannel(upperCode, 2, stateReceivedRef.current);
  }, []);

  async function resumeGameInternal(gameId: string, code: string, player: PlayerId) {
    setRoomCode(code);
    setMyPlayer(player);
    setOnlinePhase('connecting');
    statsRecorded.current = false;
    gameDbId.current = gameId;

    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('state, status, player1_id, player2_id, wager, p1_color, p2_color')
      .eq('id', gameId)
      .single();

    if (game?.wager) setGameWager(game.wager);

    if (gameErr) {
      console.error('[STONE] Resume failed:', gameErr.message);
      setOnlinePhase('error');
      setError('Could not load game. It may have been deleted.');
      return;
    }

    // If joining as P2 and player2_id isn't set yet, set it now
    if (player === 2 && game && !game.player2_id) {
      const myId = await getMyPlayerId();
      if (myId) {
        await supabase.from('games').update({
          player2_id: myId,
          status: 'active',
          p2_color: loadPlayerColor(),
          updated_at: new Date().toISOString(),
        }).eq('id', gameId);

        // Deduct wager on first join
        if (game.wager && game.wager > 0) {
          await deductCoins(myId, game.wager, 'Online game wager');
        }
      }
    }

    if (game?.state) {
      const loadedState = validateState(game.state);
      setState(loadedState);
      stateRef.current = loadedState;
      stateReceivedRef.current = true;
      setOnlinePhase('playing');
    } else {
      // No state in DB — game might be corrupted
      setOnlinePhase('error');
      setError('Game data not found. It may have been ended.');
      return;
    }

    // Load chat from DB
    if (gameId) {
      const { data: chatData } = await supabase
        .from('games')
        .select('chat')
        .eq('id', gameId)
        .single();
      if (chatData?.chat && Array.isArray(chatData.chat)) {
        const loadedMsgs = (chatData.chat as Array<{ sender: string; text: string; timestamp: number; avatarUrl?: string | null }>).map((m, i) => ({
          id: `db-${i}-${m.timestamp}`,
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp,
          isMine: m.sender === myUsernameRef.current,
          avatarUrl: m.avatarUrl || null,
        }));
        if (loadedMsgs.length > 0) setChatMessages(loadedMsgs);
      }
    }

    // Fetch opponent name and load color from DB
    if (game) {
      const opponentId = player === 1 ? game.player2_id : game.player1_id;
      if (opponentId) {
        const { data: opp } = await supabase.from('players').select('username').eq('id', opponentId).single();
        if (opp) setOpponentName(opp.username);
      }
      const oppColor = player === 1 ? game.p2_color : game.p1_color;
      if (oppColor) setOpponentColor(oppColor);
    }

    // preserveStateReceived=true so the P2 retry loop doesn't error out
    // when we already loaded state from DB
    joinChannel(code, player, true);

    // Announce presence after a short delay so the channel is subscribed
    setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'player_joined', payload: {} });
      }
    }, 1000);
  }

  const resumeGame = useCallback(async (gameId: string, code: string, player: PlayerId) => {
    await resumeGameInternal(gameId, code, player);
  }, []);

  const roll = useCallback(() => {
    if (!isMyTurn || state.phase !== 'rolling') return;
    undoStack.current = [];

    const dice = rollDice();
    const player = state.currentPlayer;

    // Track jester and doubles counts
    const jesterCount = { ...(state.jesterCount || { 1: 0, 2: 0 }) };
    const doublesCount = { ...(state.doublesCount || { 1: 0, 2: 0 }) };
    const d1J = isJester(dice.values[0]), d2J = isJester(dice.values[1]);
    if (d1J && d2J) jesterCount[player]++;
    if (!d1J && !d2J && dice.values[0] === dice.values[1]) doublesCount[player]++;

    let newState: GameState = { ...state, dice, phase: 'moving', jesterCount, doublesCount };

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
            action: `${newState.currentPlayer === 1 ? 'Sunstone' : 'Moonstone'} rolled ${isJester(dice.values[0]) ? 'Jester' : dice.values[0]}, ${isJester(dice.values[1]) ? 'Jester' : dice.values[1]} — no valid moves`,
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
            dice: { values: [0, 0], remaining: [], hasRolled: false, pendingDoubleJester: false },
            phase: 'rolling',
            turnCount: prev.turnCount + 1,
          };
          broadcastState(switched);
          return switched;
        });
      }, 3500);
      return;
    } else {
      const d1J = isJester(dice.values[0]), d2J = isJester(dice.values[1]);
      let note = '';
      if (d1J && d2J) note = ' — Double Jesters! Move 1 & 2, then choose doubles';
      else if (d1J || d2J) note = ` — Jester! 4x${d1J ? dice.values[1] : dice.values[0]}`;
      else if (dice.values[0] === dice.values[1]) note = ' (doubles!)';

      newState = {
        ...newState,
        moveLog: [
          ...newState.moveLog,
          {
            turn: newState.turnCount,
            player: newState.currentPlayer,
            action: `${GAME_CONFIG.PLAYER_NAMES[newState.currentPlayer]} rolled ${d1J ? 'Jester' : dice.values[0]}, ${d2J ? 'Jester' : dice.values[1]}${note}`,
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
    newState = { ...newState, lastMove: move };
    const winner = checkWinCondition(newState);
    if (winner) newState = { ...newState, winner, phase: 'game_over' };
    if (newState.currentPlayer !== state.currentPlayer) undoStack.current = [];

    setState(newState);
    broadcastState(newState, move);
  }, [isMyTurn, state]);

  const chooseJesterDoubles = useCallback((value: number) => {
    if (!isMyTurn) return;
    if (!state.dice.pendingDoubleJester || state.dice.remaining.length > 0) return;

    let newState: GameState = {
      ...state,
      dice: { ...state.dice, remaining: [value, value, value, value], pendingDoubleJester: false },
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
        dice: { values: newState.dice.values, remaining: [], hasRolled: false, pendingDoubleJester: false },
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
    // Keep stone_active_game in localStorage so the game shows in My Games
    // and can be resumed — only clear on game completion
    setOnlinePhase('idle');
    setMyPlayer(null);
    setOpponentConnected(false);
    setOpponentName(null);
    setOpponentColor(null);
    setChatMessages([]);
    setGameWager(0);
    setRoomCode('');
    stateReceivedRef.current = false;
    gameDbId.current = null;
    setState(() => {
      const s = createInitialState();
      return { ...s, phase: 'not_started' as GamePhase, gameMode: 'pvp' as const };
    });
  }, []);

  const sendChat = useCallback((text: string, senderName: string, senderAvatarUrl?: string | null) => {
    if (!channelRef.current) return;
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: senderName,
      text,
      timestamp: Date.now(),
      isMine: true,
      avatarUrl: senderAvatarUrl || null,
    };
    setChatMessages(prev => [...prev, msg]);
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: { sender: senderName, text, timestamp: msg.timestamp, avatarUrl: senderAvatarUrl || null },
    });

    // Persist chat to DB
    if (gameDbId.current) {
      const chatEntry = { sender: senderName, text, timestamp: msg.timestamp, avatarUrl: senderAvatarUrl || null };
      supabase
        .from('games')
        .select('chat')
        .eq('id', gameDbId.current)
        .single()
        .then(({ data }) => {
          const existing = (data?.chat as Array<{ sender: string; text: string; timestamp: number; avatarUrl?: string | null }>) || [];
          existing.push(chatEntry);
          supabase.from('games').update({ chat: existing }).eq('id', gameDbId.current!).then(() => {});
        });
    }
  }, []);

  const sendInvite = useCallback(async (toPlayerId: string): Promise<{ gameId: string; roomCode: string } | string> => {
    const code = generateRoomCode();
    const myId = await getMyPlayerId();
    if (!myId) return 'Not logged in';

    const initialState: GameState = {
      ...createInitialState(),
      phase: 'rolling',
      gameMode: 'pvp',
    };

    // Create the game room
    const { data: game, error: gameErr } = await supabase.from('games').insert({
      room_code: code,
      player1_id: myId,
      mode: 'online',
      state: initialState,
      status: 'waiting',
    }).select('id').single();

    if (gameErr || !game) return gameErr?.message || 'Failed to create game';

    // Create the invite
    const { error: inviteErr } = await supabase.from('game_invites').insert({
      from_player_id: myId,
      to_player_id: toPlayerId,
      game_id: game.id,
      room_code: code,
      status: 'pending',
    });

    if (inviteErr) return inviteErr.message;

    return { gameId: game.id, roomCode: code };
  }, []);

  const forfeit = useCallback(() => {
    if (!myPlayer) return;
    const opponentPlayer = (myPlayer === 1 ? 2 : 1) as 1 | 2;
    const forfeitState: GameState = {
      ...state,
      winner: opponentPlayer,
      phase: 'game_over',
      moveLog: [
        ...state.moveLog,
        {
          turn: state.turnCount,
          player: myPlayer,
          action: `${GAME_CONFIG.PLAYER_NAMES[myPlayer]} forfeited the game`,
          timestamp: Date.now(),
        },
      ],
    };
    setState(forfeitState);
    broadcastState(forfeitState);
  }, [myPlayer, state]);

  const awaitingJesterChoice = state.dice.pendingDoubleJester && state.dice.remaining.length === 0 && state.phase === 'moving';

  const validMoves = useMemo(() => {
    if (state.phase !== 'moving' || !isMyTurn) return [];
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
  }, [state, isMyTurn, awaitingJesterChoice]);

  const canUndo = undoStack.current.length > 0 && isMyTurn && state.phase === 'moving';

  return {
    state, roll, selectMove, undo, canUndo, validMoves,
    awaitingJesterChoice, chooseJesterDoubles,
    onlinePhase, roomCode, myPlayer, opponentConnected, opponentName, opponentColor, error,
    createRoom, joinRoom, resumeGame, leave,
    isMyTurn, pendingOpponentMove,
    chatMessages, sendChat, sendInvite, gameWager, forfeit,
  };
}
