import { useState, useRef, useEffect } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import { playYourTurnSound, setSoundEnabled, isSoundEnabled } from '../utils/sounds';
import { loadPlayerColor, STONE_COLORS } from '../utils/stoneColors';
import { StoneColorContext } from '../contexts/StoneColorContext';
import { useFriends } from '../hooks/useFriends';
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
    chatMessages, sendChat,
  } = useOnlineGame();
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { player } = usePlayerContext();
  const { addFriendById, getFriendStatus } = useFriends();
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');

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

  // Play "your turn" sound + vibrate when it becomes your turn
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && onlinePhase === 'playing') {
      playYourTurnSound();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, onlinePhase]);

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

  // Show lobby if not playing yet
  if (onlinePhase !== 'playing') {
    return (
      <OnlineLobby
        onlinePhase={onlinePhase}
        roomCode={roomCode}
        opponentConnected={opponentConnected}
        error={error}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onBack={() => { leave(); onBack(); }}
      />
    );
  }

  // Safety: if we're "playing" but state is not_started (blank), show reconnecting
  if (onlinePhase === 'playing' && state.phase === 'not_started') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="STONE" className="h-32 object-contain" />
        <p className="text-white/50 text-sm animate-pulse">Reconnecting...</p>
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
      {/* Header — click to go home */}
      <header className="shrink-0 cursor-pointer" onClick={() => { leave(); onBack(); }}>
        <img src="/logo.png" alt="STONE" className="h-12 sm:h-16 lg:h-28 object-contain" />
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
          />
        </div>

        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center">
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
