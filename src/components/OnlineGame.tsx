import { useState, useRef, useEffect } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { playYourTurnSound, setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import { loadPlayerColor, STONE_COLORS } from '../utils/stoneColors';
import { StoneColorContext } from '../contexts/StoneColorContext';
import { useFriends } from '../hooks/useFriends';
import { showNotification } from '../hooks/usePushNotifications';
import JesterCoin from './JesterCoin';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import GameControls from './GameControls';
import OnlineLobby from './OnlineLobby';
import ChatPanel from './ChatPanel';

interface OnlineGameProps {
  onBack: () => void;
  autoJoinCode?: string | null;
  resumeData?: { gameId: string; roomCode: string; player: 1 | 2 } | null;
}

export default function OnlineGame({ onBack, autoJoinCode, resumeData }: OnlineGameProps) {
  const {
    state, roll, selectMove, undo, canUndo, validMoves,
    awaitingJesterChoice, chooseJesterDoubles,
    onlinePhase, roomCode, myPlayer, opponentConnected, opponentName, opponentColor,
    error, createRoom, joinRoom, resumeGame, leave, isMyTurn, pendingOpponentMove,
    chatMessages, sendChat, gameWager, forfeit,
  } = useOnlineGame();
  const { spend, earn } = useCoins();
  const coinsHandled = useRef(false);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { player } = usePlayerContext();
  const { addFriendById, getFriendStatus } = useFriends();
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');

  // Deduct coins from joiner when they enter a wagered game
  const joinerDeducted = useRef(false);
  useEffect(() => {
    if (onlinePhase === 'playing' && myPlayer === 2 && gameWager > 0 && !joinerDeducted.current) {
      joinerDeducted.current = true;
      spend(gameWager);
    }
  }, [onlinePhase, myPlayer, gameWager, spend]);

  // Award coins on game end
  useEffect(() => {
    if (state.phase === 'game_over' && state.winner && gameWager > 0 && !coinsHandled.current) {
      coinsHandled.current = true;
      if (state.winner === myPlayer) {
        earn(gameWager * 2); // winner takes all (their own wager back + opponent's)
      }
    }
  }, [state.phase, state.winner, gameWager, myPlayer, earn]);

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

  // Resolve color conflict: P1 keeps their color, P2 gets a different one if same
  const myColor = loadPlayerColor();
  let resolvedP1Color = myPlayer === 1 ? myColor : (opponentColor || 'slate');
  let resolvedP2Color = myPlayer === 2 ? myColor : (opponentColor || 'slate');
  if (resolvedP1Color === resolvedP2Color) {
    // P2 (the joiner) gets a different color — pick the first different one
    const alt = STONE_COLORS.find(c => c.id !== resolvedP1Color);
    resolvedP2Color = alt ? alt.id : 'slate';
  }
  const prevIsMyTurn = useRef(isMyTurn);
  // Only count unread messages from opponent (not your own)
  const opponentMsgCount = chatMessages.filter(m => !m.isMine).length;
  const [lastSeenOpponentCount, setLastSeenOpponentCount] = useState(0);
  const chatUnread = chatOpen ? 0 : opponentMsgCount - lastSeenOpponentCount;

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

  // Auto-join from URL or resume from My Games
  const [autoJoined, setAutoJoined] = useState(false);
  useEffect(() => {
    if (autoJoined || onlinePhase !== 'idle') return;
    if (resumeData) {
      setAutoJoined(true);
      setTimeout(() => resumeGame(resumeData.gameId, resumeData.roomCode, resumeData.player), 100);
    } else if (autoJoinCode) {
      setAutoJoined(true);
      setTimeout(() => joinRoom(autoJoinCode), 100);
    }
  }, [autoJoined, onlinePhase, resumeData, autoJoinCode, resumeGame, joinRoom]);

  // Safety log
  useEffect(() => {
    if (onlinePhase === 'playing' && state.phase === 'not_started') {
      console.error('[STONE] Playing phase but state is not_started — this should not happen');
    }
  }, [onlinePhase, state.phase]);

  // Show lobby if not playing yet
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  const handleForfeit = () => {
    setShowForfeitConfirm(false);
    forfeit(); // broadcasts game_over to opponent, triggers coin award via existing effect
  };

  const handleCreateRoom = async (wager: number) => {
    if (wager > 0) {
      const ok = await spend(wager);
      if (!ok) return;
    }
    coinsHandled.current = false;
    joinerDeducted.current = false;
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

  const playerLabel = myPlayer === 1 ? 'Sunstone' : 'Moonstone';
  const waitingForOpponent = !isMyTurn && state.phase !== 'game_over';

  const colorCtx = { p1ColorId: resolvedP1Color, p2ColorId: resolvedP2Color };

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

      {/* Turn + online info */}
      <div className="flex items-center gap-2 shrink-0">
        <TurnIndicator currentPlayer={state.currentPlayer} phase={state.phase} winner={state.winner} player1Name={p1Name} player2Name={p2Name} isMyTurn={isMyTurn} />
        {waitingForOpponent && (
          <span className="text-[10px] lg:text-xs text-white animate-pulse">Opponent's turn...</span>
        )}
      </div>

      {/* Online status bar */}
      <div className="flex items-center gap-2 shrink-0 text-[9px]">
        <span className="text-white">Room: <span className="text-amber-400 font-heading tracking-wider">{roomCode}</span></span>
        {gameWager > 0 && (
          <>
            <span className="text-white/50">|</span>
            <span className="text-amber-400/80 flex items-center gap-1"><JesterCoin size={12} /> {gameWager} wager</span>
          </>
        )}
        <span className="text-white/50">|</span>
        <span className="text-white">You: {playerLabel}</span>
        <span className="text-white/50">|</span>
        <span className={opponentConnected ? 'text-white' : 'text-white animate-pulse'}>
          {opponentConnected
            ? 'Opponent is live'
            : `${opponentName || 'Opponent'} has stepped away`}
        </span>
        <span className={`w-2 h-2 rounded-full ${opponentConnected ? 'bg-green-400' : 'bg-white/30'}`} />
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
            pendingAIMove={pendingOpponentMove}
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
            <button onClick={() => setShowForfeitConfirm(true)}
              className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer mt-2">
              Forfeit {gameWager > 0 && `(-${gameWager} coins)`}
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden flex items-center gap-1 py-0.5 shrink-0">
        {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
        <button onClick={() => { leave(); onBack(); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap">
          Leave
        </button>
        <button onClick={() => setHintsEnabled(h => !h)}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap">
          Hints {hintsEnabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap">
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button onClick={() => { setShowMobileLog(v => !v); setChatOpen(false); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap">
          {showMobileLog ? 'Hide Log' : 'Log'}
        </button>
        {state.phase !== 'game_over' && (
          <button onClick={() => setShowForfeitConfirm(true)}
            className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                       bg-red-900/40 text-red-400 border border-red-800/40
                       cursor-pointer shadow-md whitespace-nowrap">
            Forfeit
          </button>
        )}
        <ChatPanel
          messages={chatMessages}
          onSend={(text) => sendChat(text, myName || 'Player', player?.avatarUrl)}
          isOpen={false}
          onToggle={() => { setChatOpen(v => !v); setShowMobileLog(false); setLastSeenOpponentCount(opponentMsgCount); }}
          unreadCount={chatUnread}
        />
      </div>

      {showMobileLog && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 max-h-[40vh] z-40 overflow-y-auto rounded-xl shadow-2xl">
          <MoveLog entries={state.moveLog} />
        </div>
      )}

      {chatOpen && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 z-40">
          <ChatPanel
            messages={chatMessages}
            onSend={(text) => sendChat(text, myName || 'Player', player?.avatarUrl)}
            isOpen={true}
            onToggle={() => { setChatOpen(false); setLastSeenOpponentCount(opponentMsgCount); }}
          />
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
            <button onClick={() => { leave(); onBack(); }}
              className="px-6 py-3 rounded-lg font-heading text-sm uppercase tracking-wider
                         bg-highlight-selected text-stone-bg hover:brightness-110 cursor-pointer shadow-lg mt-4">
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
    </StoneColorContext.Provider>
  );
}
