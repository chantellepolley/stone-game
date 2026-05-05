import { useState, useRef, useEffect } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { playYourTurnSound, setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import { loadPlayerColor } from '../utils/stoneColors';
import { StoneColorContext } from '../contexts/StoneColorContext';
import { useFriends } from '../hooks/useFriends';
import { showNotification } from '../hooks/usePushNotifications';
import { awardGameBonuses, type BonusResult } from '../lib/bonuses';
import JesterCoin from './JesterCoin';
import Board from './Board';
import DiceArea from './DiceArea';

import MoveLog from './MoveLog';
import GameControls from './GameControls';
import OnlineLobby from './OnlineLobby';
import ChatPanel from './ChatPanel';

interface OnlineGameProps {
  onBack: () => void;
  autoJoinCode?: string | null;
  resumeData?: { gameId: string; roomCode: string; player: 1 | 2; inviteId?: string } | null;
  onInviteFriend?: (playerId: string, wager: number) => void;
  onResumeLocalGame?: (gameId: string) => void;
}

export default function OnlineGame({ onBack, autoJoinCode, resumeData, onInviteFriend, onResumeLocalGame }: OnlineGameProps) {
  const {
    state, roll, selectMove, undo, canUndo, validMoves,
    awaitingJesterChoice, chooseJesterDoubles,
    onlinePhase, roomCode, myPlayer, opponentConnected, opponentName, opponentAvatar, opponentColor,
    error, createRoom, joinRoom, resumeGame, leave, isMyTurn, pendingOpponentMove,
    chatMessages, sendChat, gameWager, forfeit,
    wagerProposal, proposeWager, acceptWager, declineWager,
    myProposalStatus,
    sendNudge, lastNudge, myGameColor, currentGameId,
  } = useOnlineGame();
  const { coins, spend, earn } = useCoins();
  const coinsHandled = useRef(false);
  const [gameBonuses, setGameBonuses] = useState<BonusResult[]>([]);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeGames, setActiveGames] = useState<Array<{ id: string; room_code: string; opponent_name: string; opponent_avatar: string | null; my_player: 1 | 2; is_my_turn: boolean; mode: string }>>([]);
  const { player } = usePlayerContext();
  const { addFriendById, getFriendStatus } = useFriends();
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');

  // Joiner wager is now deducted in useOnlineGame.joinRoom (DB-side, once only)

  // Award coins + bonuses on game end
  useEffect(() => {
    if (state.phase === 'game_over' && state.winner && !coinsHandled.current) {
      coinsHandled.current = true;
      const isWin = state.winner === myPlayer;
      if (isWin && gameWager > 0) {
        earn(gameWager * 2, 'Online game win');
      }
      if (player) {
        const stateWithWager = { ...state, wager: gameWager };
        awardGameBonuses(player.id, stateWithWager, state.winner, isWin, currentGameId || undefined).then(bonuses => {
          setGameBonuses(bonuses);
        });
      }
    }
  }, [state.phase, state.winner, gameWager, myPlayer, earn, player]);

  // Load active games (online + AI) for the tabs bar
  useEffect(() => {
    if (!player || onlinePhase !== 'playing') return;
    let sb: any;
    const loadGames = async () => {
      if (!sb) { sb = (await import('../lib/supabase')).supabase; }
      const { data } = await sb
        .from('games')
        .select('id, room_code, player1_id, player2_id, state, mode')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .eq('status', 'active')
        .in('mode', ['online', 'ai'])
        .order('updated_at', { ascending: false })
        .limit(20);
      if (!data) return;

      const opponentIds = data.filter((g: any) => g.mode === 'online').map((g: any) => g.player1_id === player.id ? g.player2_id : g.player1_id).filter(Boolean);
      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {};
      if (opponentIds.length > 0) {
        const { data: players } = await sb.from('players').select('id, username, avatar_url').in('id', opponentIds);
        players?.forEach((p: any) => { nameMap[p.id] = p.username; avatarMap[p.id] = p.avatar_url; });
      }

      setActiveGames(data.map((g: any) => {
        const myP = g.player1_id === player.id ? 1 : 2;
        const oppId = myP === 1 ? g.player2_id : g.player1_id;
        const currentPlayer = (g.state as any)?.currentPlayer || 1;
        const aiDiff = (g.state as any)?.aiDifficulty || 'medium';
        const isAI = g.mode === 'ai';
        return {
          id: g.id,
          room_code: g.room_code,
          opponent_name: isAI ? `AI (${aiDiff.charAt(0).toUpperCase() + aiDiff.slice(1)})` : (oppId ? (nameMap[oppId] || 'Unknown') : 'Waiting'),
          opponent_avatar: isAI ? null : (oppId ? (avatarMap[oppId] || null) : null),
          my_player: myP as 1 | 2,
          is_my_turn: isAI ? true : currentPlayer === myP,
          mode: g.mode,
        };
      }));
    };
    loadGames();

    // Subscribe to realtime changes on games table for instant updates
    let channel: any;
    import('../lib/supabase').then(({ supabase: s }) => {
      sb = s;
      channel = s.channel('game-tabs-online')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        }, (payload: any) => {
          const g = payload.new;
          if (g.player1_id === player.id || g.player2_id === player.id) {
            loadGames();
          }
        })
        .subscribe();
    });

    return () => { if (channel && sb) sb.removeChannel(channel); };
  }, [player, onlinePhase]);

  // Check friend status with opponent
  useEffect(() => {
    if (!opponentName || !roomCode || !myPlayer) return;
    (async () => {
      const { supabase: sb } = await import('../lib/supabase');
      const { data } = await sb.from('games').select('player1_id, player2_id').eq('room_code', roomCode).single();
      const oppId = myPlayer === 1 ? data?.player2_id : data?.player1_id;
      if (oppId) {
        const status = await getFriendStatus(oppId);
        if (status !== 'none') setFriendStatus(status);
      }
    })();
  }, [opponentName, roomCode, myPlayer, getFriendStatus]);

  const myName = player?.username;
  const p1Name = myPlayer === 1 ? myName : (opponentName || undefined);
  const p2Name = myPlayer === 2 ? myName : (opponentName || undefined);

  // Resolve colors — use DB-stored game colors, fall back to localStorage/default
  const myColor = myGameColor || loadPlayerColor();
  let resolvedP1Color = myPlayer === 1 ? myColor : (opponentColor || 'sandstone');
  let resolvedP2Color = myPlayer === 2 ? myColor : (opponentColor || 'sandstone');
  let p1BorderOverride: string | undefined;
  let p2BorderOverride: string | undefined;
  if (resolvedP1Color === resolvedP2Color) {
    // Same color — keep it, but give distinct borders so players can tell apart
    p1BorderOverride = 'rgba(255, 200, 50, 0.7)';  // gold border
    p2BorderOverride = 'rgba(180, 180, 220, 0.7)';  // silver border
  }
  const prevIsMyTurn = useRef(isMyTurn);
  // Only count unread messages from opponent (not your own)
  const opponentMsgCount = chatMessages.filter(m => !m.isMine).length;
  const [lastSeenOpponentCount, setLastSeenOpponentCount] = useState<number | null>(null);
  // Load last seen count from localStorage for this game
  useEffect(() => {
    if (onlinePhase === 'playing' && roomCode && lastSeenOpponentCount === null) {
      const saved = localStorage.getItem(`stone_chat_seen_${roomCode}`);
      setLastSeenOpponentCount(saved ? parseInt(saved) : 0);
    }
  }, [onlinePhase, roomCode, lastSeenOpponentCount]);
  // Save last seen count when chat is opened
  useEffect(() => {
    if (chatOpen && roomCode && opponentMsgCount > 0) {
      localStorage.setItem(`stone_chat_seen_${roomCode}`, String(opponentMsgCount));
    }
  }, [chatOpen, roomCode, opponentMsgCount]);
  const chatUnread = lastSeenOpponentCount === null ? 0 : chatOpen ? 0 : Math.max(0, opponentMsgCount - lastSeenOpponentCount);

  // Replay opponent's last move animation when entering the game
  const recapShown = useRef(false);
  const [replayMove, setReplayMove] = useState<typeof pendingOpponentMove>(null);
  useEffect(() => {
    if (onlinePhase === 'playing' && isMyTurn && !recapShown.current && state.lastMove) {
      recapShown.current = true;
      // Only replay if the last move was by the opponent
      const lastMovePiece = [...state.board.flat(), ...Object.values(state.home).flat(), ...Object.values(state.jail).flat()]
        .find(p => p.id === state.lastMove?.pieceId);
      if (lastMovePiece && lastMovePiece.owner !== myPlayer) {
        // Briefly show the move animation
        setReplayMove(state.lastMove);
        setTimeout(() => setReplayMove(null), 800);
      }
    }
  }, [onlinePhase, isMyTurn, state.lastMove, myPlayer]);

  // Play "your turn" sound + vibrate + system notification
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && onlinePhase === 'playing') {
      playYourTurnSound();
      // Show system notification (works when app is backgrounded)
      if (document.visibilityState === 'hidden') {
        showNotification('STONE - Your Turn!', `${opponentName || 'Your opponent'} made their move. It's your turn!`, 'your-turn');
      }
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, onlinePhase, opponentName]);

  // Auto-join from URL or resume from My Games / invite accept
  const [autoJoined, setAutoJoined] = useState<string | null>(null);
  useEffect(() => {
    // Build a unique key for this join target
    const joinKey = resumeData ? `resume-${resumeData.gameId}` : autoJoinCode ? `join-${autoJoinCode}` : null;
    if (!joinKey || autoJoined === joinKey) return;

    const doJoin = async () => {
      // If we're in the middle of another game, leave it first
      if (onlinePhase !== 'idle') {
        leave();
        // Give it a moment to clean up
        await new Promise(r => setTimeout(r, 200));
      }

      setAutoJoined(joinKey);
      if (resumeData) {
        await resumeGame(resumeData.gameId, resumeData.roomCode, resumeData.player);
        // Mark invite as accepted now that we've successfully joined
        if (resumeData.inviteId) {
          const { supabase: sb } = await import('../lib/supabase');
          await sb.from('game_invites').update({ status: 'accepted' }).eq('id', resumeData.inviteId);
        }
      } else if (autoJoinCode) {
        joinRoom(autoJoinCode);
      }
    };
    doJoin();
  }, [resumeData, autoJoinCode, autoJoined, onlinePhase, resumeGame, joinRoom, leave]);

  // Safety log
  useEffect(() => {
    if (onlinePhase === 'playing' && state.phase === 'not_started') {
      console.error('[STONE] Playing phase but state is not_started — this should not happen');
    }
  }, [onlinePhase, state.phase]);

  // Show lobby if not playing yet
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [showWagerPicker, setShowWagerPicker] = useState(false);
  const [proposedAmount, setProposedAmount] = useState(0);
  const [proposalDismissed, setProposalDismissed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleForfeit = () => {
    setShowForfeitConfirm(false);
    forfeit(); // broadcasts game_over to opponent, triggers coin award via existing effect
  };

  const handleCreateRoom = async (wager: number) => {
    if (wager > 0) {
      const ok = await spend(wager, 'Online game wager');
      if (!ok) return;
    }
    coinsHandled.current = false;
    createRoom(wager);
  };

  if (onlinePhase !== 'playing') {
    return (
      <OnlineLobby
        onlinePhase={onlinePhase}
        roomCode={roomCode}
        opponentConnected={opponentConnected}
        error={error}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={joinRoom}
        onBack={() => { leave(); onBack(); }}
        gameWager={gameWager}
        onInviteFriend={onInviteFriend}
      />
    );
  }

  if (onlinePhase === 'playing' && state.phase === 'not_started') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="STONE" className="h-32 object-contain" />
        <p className="text-white/50 text-sm animate-pulse">Loading game...</p>
        <button onClick={() => { leave(); onBack(); }}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-4">
          Back to Menu
        </button>
      </div>
    );
  }


  const colorCtx = { p1ColorId: resolvedP1Color, p2ColorId: resolvedP2Color, p1BorderOverride, p2BorderOverride };

  return (
    <StoneColorContext.Provider value={colorCtx}>
    <div className="fixed inset-0 flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-0.5 lg:gap-1 overflow-y-auto overflow-x-hidden">
      {/* Header + Home button */}
      <header className="shrink-0 flex items-center gap-2">
        <img src="/logo.png" alt="STONE" className="h-12 sm:h-16 lg:h-28 object-contain cursor-pointer" onClick={() => { leave(); onBack(); }} />
        <button onClick={() => { leave(); onBack(); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white/70 border border-[#6b5f55] hover:text-white hover:bg-[#5e5549]
                     cursor-pointer transition-colors shadow-md">
          Home
        </button>
      </header>

      {/* Player vs Opponent display */}
      <div className="flex items-center justify-center gap-3 shrink-0 w-full max-w-md">
        {/* Me */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${isMyTurn ? 'bg-amber-600/20 ring-1 ring-amber-400/50' : ''}`}>
          {player?.avatarUrl ? (
            <img src={player.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
              <span className="text-[9px] font-heading text-white/50">{myName?.[0]?.toUpperCase() || '?'}</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-heading text-white truncate max-w-[70px]">{myName || 'You'}</span>
            {isMyTurn && <span className="text-[8px] text-amber-400 font-heading">Your turn</span>}
          </div>
        </div>

        {/* VS + wager */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-heading text-white/40">VS</span>
          {gameWager > 0 && (
            <button onClick={state.phase !== 'game_over' ? () => { setProposedAmount(gameWager * 2); setShowWagerPicker(true); } : undefined}
              className={`flex items-center gap-0.5 text-[9px] text-amber-400/80 ${state.phase !== 'game_over' ? 'cursor-pointer hover:text-amber-400' : ''}`}>
              <JesterCoin size={10} /> {gameWager}
            </button>
          )}
        </div>

        {/* Opponent */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${!isMyTurn && state.phase !== 'game_over' ? 'bg-sky-600/20 ring-1 ring-sky-400/50' : ''}`}>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-heading text-white truncate max-w-[70px]">{opponentName || 'Opponent'}</span>
            <div className="flex items-center gap-1">
              {!isMyTurn && state.phase !== 'game_over' && <span className="text-[8px] text-sky-400 font-heading">Their turn</span>}
              <span className={`w-1.5 h-1.5 rounded-full ${opponentConnected ? 'bg-green-400' : 'bg-white/30'}`} />
            </div>
          </div>
          {opponentAvatar ? (
            <img src={opponentAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
              <span className="text-[9px] font-heading text-white/50">{opponentName?.[0]?.toUpperCase() || '?'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Room code + friend status */}
      <div className="flex items-center gap-2 shrink-0 text-[9px]">
        <span className="text-white/40">Room: <span className="text-amber-400/60 font-heading tracking-wider">{roomCode}</span></span>
        {opponentName && (
          <>
            <span className="text-white/50">|</span>
            {friendStatus === 'accepted' ? (
              <span className="text-[8px] text-green-400/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Friends
              </span>
            ) : friendStatus === 'pending' || friendStatus === 'sent' ? (
              <span className="text-[8px] text-amber-400/70">Pending</span>
            ) : (
              <button
                onClick={async () => {
                  const oppId = myPlayer === 1
                    ? (await import('../lib/supabase').then(m => m.supabase.from('games').select('player2_id').eq('room_code', roomCode).single())).data?.player2_id
                    : (await import('../lib/supabase').then(m => m.supabase.from('games').select('player1_id').eq('room_code', roomCode).single())).data?.player1_id;
                  if (oppId) {
                    const r = await addFriendById(oppId);
                    if (r === true) setFriendStatus('sent');
                    else if (r === 'Already friends') setFriendStatus('accepted');
                    else if (r === 'Friend invite already sent') setFriendStatus('pending');
                  }
                }}
                className="px-2 py-0.5 rounded text-[8px] font-heading uppercase tracking-wider
                           bg-amber-600/70 text-white hover:bg-amber-600 cursor-pointer transition-colors"
              >
                + Add Friend
              </button>
            )}
          </>
        )}
      </div>

      {/* Mobile: dice */}
      <div className="lg:hidden flex items-center justify-center gap-2 shrink-0">
        <DiceArea
          dice={state.dice} phase={state.phase} currentPlayer={state.currentPlayer}
          onRoll={roll}
          awaitingJesterChoice={awaitingJesterChoice && isMyTurn}
          onChooseJesterDoubles={chooseJesterDoubles}
          isAITurn={!isMyTurn}
          player1Name={p1Name}
          player2Name={p2Name}
        />
      </div>

      {/* Main layout */}
      <div className="flex gap-3 items-start w-full max-w-[1250px] justify-center flex-1">
        <div className="hidden lg:flex flex-col gap-3 w-[200px] shrink-0">
          <MoveLog entries={state.moveLog} />
          <ChatPanel
            messages={chatMessages}
            onSend={(text) => sendChat(text, myName || 'Player', player?.avatarUrl)}
            isOpen={true}
          />
          <GameControls onRestart={() => { leave(); onBack(); }} />
        </div>

        <div className="flex-1 max-w-[1050px] w-full min-h-0">
          <Board
            state={state}
            validMoves={isMyTurn ? validMoves : []}
            onSelectMove={selectMove}
            pendingAIMove={pendingOpponentMove || replayMove}
            hintsEnabled={hintsEnabled}
            myPlayer={myPlayer || 1}
          />
        </div>

        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center z-10">
          <DiceArea
            dice={state.dice} phase={state.phase} currentPlayer={state.currentPlayer}
            onRoll={roll}
            awaitingJesterChoice={awaitingJesterChoice && isMyTurn}
            onChooseJesterDoubles={chooseJesterDoubles}
            isAITurn={!isMyTurn}
            player1Name={p1Name}
            player2Name={p2Name}
          />
          {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
          <button onClick={() => setHintsEnabled(h => !h)}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer">
            Hints: {hintsEnabled ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer">
            Sound: {soundOn ? 'ON' : 'OFF'}
          </button>
          {state.phase !== 'game_over' && (
            <>
              {!isMyTurn && (
                <button onClick={sendNudge}
                  disabled={Date.now() - lastNudge < 60000}
                  className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer mt-2
                             disabled:opacity-30 disabled:cursor-not-allowed">
                  Nudge
                </button>
              )}
              <button onClick={() => { setProposedAmount(gameWager > 0 ? gameWager * 2 : 5); setShowWagerPicker(true); }}
                className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer">
                {gameWager > 0 ? 'Raise Wager' : 'Add Wager'}
              </button>
              <button onClick={() => setShowForfeitConfirm(true)}
                className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer">
                Forfeit {gameWager > 0 && `(-${gameWager} coins)`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active games tabs — above bottom bar */}
      {activeGames.length > 1 && (
        <div className="flex gap-1.5 shrink-0 overflow-x-auto max-w-full px-1 py-0.5 no-scrollbar justify-center">
          {activeGames.map(g => {
            const isCurrent = g.room_code === roomCode;
            return (
              <button
                key={g.id}
                onClick={() => {
                  if (isCurrent) return;
                  if (g.mode === 'ai' && onResumeLocalGame) {
                    leave();
                    onResumeLocalGame(g.id);
                    return;
                  }
                  leave();
                  resumeGame(g.id, g.room_code, g.my_player);
                  coinsHandled.current = false;
                  setChatOpen(false);
                  setShowMobileLog(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-heading shrink-0 transition-all
                  ${isCurrent
                    ? 'bg-amber-600/30 border border-amber-400/50 text-white'
                    : 'bg-black/20 border border-[#6b5f55]/30 text-white/50 hover:text-white/80 cursor-pointer'
                  }`}
              >
                {g.opponent_avatar ? (
                  <img src={g.opponent_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#3d3632] flex items-center justify-center">
                    <span className="text-[7px] text-white/40">{g.opponent_name[0]?.toUpperCase()}</span>
                  </div>
                )}
                <span className="truncate max-w-[50px]">{g.opponent_name}</span>
                {g.is_my_turn && !isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile bottom bar — just Menu, Undo, and Chat */}
      <div className="lg:hidden flex items-center gap-3 py-1.5 shrink-0 justify-center">
        {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
        <button onClick={() => { setShowMobileMenu(true); setChatOpen(false); setShowMobileLog(false); }}
          className="px-6 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md min-w-[100px]">
          Menu
        </button>
        <button onClick={() => { setChatOpen(v => !v); setShowMobileLog(false); setShowMobileMenu(false); setLastSeenOpponentCount(opponentMsgCount); if (roomCode) localStorage.setItem(`stone_chat_seen_${roomCode}`, String(opponentMsgCount)); }}
          className="relative px-6 py-2.5 rounded-xl text-xs font-heading uppercase tracking-wider
                     bg-amber-600 text-white border border-amber-500 cursor-pointer shadow-md min-w-[100px]
                     hover:bg-amber-500 transition-colors">
          Chat
          {chatUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </button>
      </div>

      {/* Mobile menu popup */}
      {showMobileMenu && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 z-40 animate-[slideIn_0.2s_ease-out]">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-3 shadow-2xl">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { leave(); onBack(); setShowMobileMenu(false); }}
                className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Back to Menu
              </button>
              <button onClick={() => { setShowMobileLog(v => !v); setShowMobileMenu(false); }}
                className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                {showMobileLog ? 'Hide Log' : 'Move Log'}
              </button>
              <button onClick={() => { setHintsEnabled(h => !h); setShowMobileMenu(false); }}
                className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Hints {hintsEnabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); setShowMobileMenu(false); }}
                className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Sound {soundOn ? 'ON' : 'OFF'}
              </button>
              {state.phase !== 'game_over' && !isMyTurn && (
                <button onClick={() => { sendNudge(); setShowMobileMenu(false); }}
                  disabled={Date.now() - lastNudge < 60000}
                  className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                             bg-[#5e5549] text-amber-400 hover:bg-[#6b5f55] cursor-pointer transition-colors
                             disabled:opacity-30 disabled:cursor-not-allowed">
                  Nudge Opponent
                </button>
              )}
              {state.phase !== 'game_over' && (
                <button onClick={() => { setProposedAmount(gameWager > 0 ? gameWager * 2 : 5); setShowWagerPicker(true); setShowMobileMenu(false); }}
                  className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                             bg-[#5e5549] text-amber-400 hover:bg-[#6b5f55] cursor-pointer transition-colors">
                  {gameWager > 0 ? 'Raise Wager' : 'Add Wager'}
                </button>
              )}
              {state.phase !== 'game_over' && (
                <button onClick={() => { setShowForfeitConfirm(true); setShowMobileMenu(false); }}
                  className="px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                             bg-red-900/30 text-red-400/70 hover:text-red-400 hover:bg-red-900/50 cursor-pointer transition-colors">
                  Forfeit
                </button>
              )}
            </div>
            <button onClick={() => setShowMobileMenu(false)}
              className="w-full mt-2 px-3 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-white/10 text-white/60 hover:bg-white/20 cursor-pointer transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {showMobileLog && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 max-h-[40vh] z-40 overflow-y-auto rounded-xl shadow-2xl">
          <div className="relative">
            <button onClick={() => setShowMobileLog(false)}
              className="absolute top-1 right-2 text-white/60 hover:text-white text-sm cursor-pointer z-10 bg-[#504840] rounded-full w-6 h-6 flex items-center justify-center">
              x
            </button>
            <MoveLog entries={state.moveLog} />
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 z-40">
          <ChatPanel
            messages={chatMessages}
            onSend={(text) => sendChat(text, myName || 'Player', player?.avatarUrl)}
            isOpen={true}
            onToggle={() => { setChatOpen(false); setLastSeenOpponentCount(opponentMsgCount); if (roomCode) localStorage.setItem(`stone_chat_seen_${roomCode}`, String(opponentMsgCount)); }}
          />
        </div>
      )}

      {/* No valid moves overlay */}
      {state.phase === 'no_moves' && (
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-40 animate-[slideIn_0.3s_ease-out]">
          <div className="bg-[#504840] border-2 border-red-600/50 rounded-xl px-6 py-4 shadow-2xl text-center">
            <p className="text-red-400 font-heading text-sm uppercase tracking-wider">No valid moves!</p>
            {state.dice.values[0] > 0 && (
              <div className="flex gap-2 justify-center my-2">
                {state.dice.values.map((v, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg border-2 border-red-600/40 flex items-center justify-center"
                    style={{ backgroundImage: "url('/stone-bg.jpg')", backgroundSize: '60px', filter: 'brightness(1.2)' }}>
                    {v === 6 ? (
                      <img src="/jester-dice.png" alt="Jester" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-lg">{v}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/50 text-[10px]">Skipping turn...</p>
          </div>
        </div>
      )}

      {/* Incoming wager proposal from opponent */}
      {wagerProposal && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-[slideIn_0.3s_ease-out] max-w-sm w-full px-4">
          <div className="bg-[#504840] border-2 border-amber-600/60 rounded-xl p-4 shadow-2xl text-center">
            <p className="text-amber-400 font-heading text-sm mb-1">Wager Proposal</p>
            <p className="text-white/70 text-xs mb-3">
              {wagerProposal.from} wants to {gameWager > 0 ? `raise the wager to` : `set a wager of`} <span className="text-amber-400 font-heading">{wagerProposal.amount}</span> <JesterCoin size={12} />
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={acceptWager}
                className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                Accept
              </button>
              <button onClick={declineWager}
                className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My outgoing proposal status */}
      {myProposalStatus && !wagerProposal && !proposalDismissed && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4">
          <div className={`rounded-xl p-3 shadow-2xl text-center border-2 relative ${
            myProposalStatus.status === 'accepted' ? 'bg-green-900/80 border-green-500/60' :
            myProposalStatus.status === 'declined' ? 'bg-red-900/80 border-red-500/60' :
            'bg-[#504840] border-amber-600/40'
          }`}>
            <button onClick={() => setProposalDismissed(true)}
              className="absolute top-1 right-2 text-white/40 hover:text-white text-sm cursor-pointer">
              x
            </button>
            <div className="flex items-center justify-center gap-2 pr-4">
              {myProposalStatus.status === 'pending' && (
                <>
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-amber-400 text-xs font-heading">
                    Wager proposal sent ({myProposalStatus.amount} <JesterCoin size={10} />). Waiting...
                  </span>
                </>
              )}
              {myProposalStatus.status === 'seen' && (
                <>
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-amber-400 text-xs font-heading">
                    Opponent saw your {myProposalStatus.amount} <JesterCoin size={10} /> proposal. Deciding...
                  </span>
                </>
              )}
              {myProposalStatus.status === 'accepted' && (
                <span className="text-green-400 text-xs font-heading">
                  Wager raised to {myProposalStatus.amount} <JesterCoin size={10} />!
                </span>
              )}
              {myProposalStatus.status === 'declined' && (
                <span className="text-red-400 text-xs font-heading">
                  Opponent declined your {myProposalStatus.amount} <JesterCoin size={10} /> wager. Coins refunded.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Propose wager picker */}
      {showWagerPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-1">{gameWager > 0 ? 'Raise Wager' : 'Propose Wager'}</h2>
            <p className="text-white/50 text-xs mb-3">Your opponent must agree</p>
            <div className="flex gap-2 justify-center mb-3 flex-wrap">
              {[5, 10, 25, 50, 100].filter(v => v > gameWager).map(v => (
                <button key={v} onClick={() => setProposedAmount(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading transition-all cursor-pointer
                    ${proposedAmount === v
                      ? 'bg-amber-600 text-white border-2 border-amber-400'
                      : 'bg-black/30 text-white/60 border-2 border-[#6b5f55] hover:border-amber-600/40'}
                    ${(coins !== null && coins < v - gameWager) ? 'opacity-30 cursor-not-allowed' : ''}`}
                  disabled={coins !== null && coins < v - gameWager}
                >
                  {v} <JesterCoin size={10} />
                </button>
              ))}
            </div>
            {gameWager > 0 && (
              <p className="text-white/30 text-[9px] mb-3">Current wager: {gameWager}. You pay the difference.</p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { proposeWager(proposedAmount); setShowWagerPicker(false); setProposalDismissed(false); }}
                disabled={proposedAmount <= gameWager}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed">
                Propose
              </button>
              <button onClick={() => setShowWagerPicker(false)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forfeit confirmation */}
      {showForfeitConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-2">Forfeit Game?</h2>
            <p className="text-white/60 text-sm mb-4">
              {gameWager > 0
                ? `You will lose your ${gameWager} coin wager and your opponent wins.`
                : 'Your opponent will be declared the winner.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleForfeit}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-red-600 text-white hover:bg-red-500 cursor-pointer transition-colors">
                Forfeit
              </button>
              <button onClick={() => setShowForfeitConfirm(false)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory */}
      {state.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-board-bg border-4 border-stone-border rounded-2xl p-6 lg:p-8 text-center shadow-2xl max-w-md mx-4">
            <div className="text-5xl lg:text-6xl mb-4">{state.winner === 1 ? '☀' : '☽'}</div>
            <h2 className="font-heading text-2xl lg:text-3xl text-highlight-selected mb-2">
              {state.winner === myPlayer
                ? `${myName || GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!`
                : `${(state.winner === 1 ? p1Name : p2Name) || GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!`}
            </h2>
            <p className="text-white/60 mb-2 text-sm">
              {state.winner === myPlayer ? 'Congratulations!' : 'Better luck next time!'}
            </p>
            {gameWager > 0 && (
              <p className={`text-sm font-heading mb-2 ${state.winner === myPlayer ? 'text-green-400' : 'text-red-400'}`}>
                {state.winner === myPlayer ? `+${gameWager} coins won!` : `-${gameWager} coins lost`} <JesterCoin size={16} />
              </p>
            )}
            {gameBonuses.length > 0 && (
              <div className="space-y-1 mb-3">
                {gameBonuses.map((b, i) => (
                  <div key={i} className="flex items-center justify-center gap-1.5 text-xs">
                    <span className="text-green-400 font-heading">+{b.amount}</span>
                    <JesterCoin size={12} />
                    <span className="text-amber-400/80">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 items-center mt-4">
              <div className="flex gap-3">
                <button onClick={() => { leave(); onBack(); }}
                  className="px-6 py-3 rounded-lg font-heading text-sm uppercase tracking-wider
                             bg-highlight-selected text-stone-bg hover:brightness-110 cursor-pointer shadow-lg">
                  Play Again
                </button>
                <button onClick={() => { leave(); onBack(); }}
                  className="px-6 py-3 rounded-lg font-heading text-sm uppercase tracking-wider
                             bg-[#5e5549] text-white border border-[#6b5f55]
                             hover:bg-[#6b5f55] transition-all cursor-pointer shadow-lg">
                  Home
                </button>
              </div>
              <button
                onClick={() => {
                  const text = `I just played STONE! Join me and we both get 100 coins!\nhttps://stonethegame.com`;
                  if (navigator.share) {
                    navigator.share({ title: 'Join STONE!', text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text);
                  }
                }}
                className="px-6 py-2 rounded-lg font-heading text-[11px] uppercase tracking-wider
                           bg-amber-600/80 text-white border border-amber-500/60
                           hover:bg-amber-600 transition-all cursor-pointer shadow-lg flex items-center gap-2">
                Invite a Friend
                <span className="text-[9px] normal-case text-amber-200">You both get 100 coins!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </StoneColorContext.Provider>
  );
}
