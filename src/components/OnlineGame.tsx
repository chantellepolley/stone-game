import { useState } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import GameControls from './GameControls';
import OnlineLobby from './OnlineLobby';

interface OnlineGameProps {
  onBack: () => void;
  autoJoinCode?: string | null;
  resumeData?: { gameId: string; roomCode: string; player: 1 | 2 } | null;
}

export default function OnlineGame({ onBack, autoJoinCode, resumeData }: OnlineGameProps) {
  const {
    state, roll, selectMove, undo, canUndo, validMoves,
    awaitingJokerChoice, chooseJokerDoubles,
    onlinePhase, roomCode, myPlayer, opponentConnected,
    error, createRoom, joinRoom, resumeGame, leave, isMyTurn, pendingOpponentMove,
  } = useOnlineGame();
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [showMobileLog, setShowMobileLog] = useState(false);
  const { player } = usePlayerContext();

  const myName = player?.username;
  const p1Name = myPlayer === 1 ? myName : undefined;
  const p2Name = myPlayer === 2 ? myName : undefined;

  // Auto-join from URL or resume from My Games
  const [autoJoined, setAutoJoined] = useState(false);
  if (!autoJoined && onlinePhase === 'idle') {
    if (resumeData) {
      setAutoJoined(true);
      setTimeout(() => resumeGame(resumeData.gameId, resumeData.roomCode, resumeData.player), 100);
    } else if (autoJoinCode) {
      setAutoJoined(true);
      setTimeout(() => joinRoom(autoJoinCode), 100);
    }
  }

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

  const playerLabel = myPlayer === 1 ? 'Sunstone' : 'Moonstone';
  const waitingForOpponent = !isMyTurn && state.phase !== 'game_over';

  return (
    <div className="fixed inset-0 flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-0.5 lg:gap-1 overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <header className="shrink-0">
        <img src="/logo.png" alt="STONE" className="h-12 sm:h-16 lg:h-28 object-contain" />
      </header>

      {/* Turn + online info */}
      <div className="flex items-center gap-2 shrink-0">
        <TurnIndicator currentPlayer={state.currentPlayer} phase={state.phase} winner={state.winner} player1Name={p1Name} player2Name={p2Name} />
        {waitingForOpponent && (
          <span className="text-[10px] lg:text-xs text-white/40 animate-pulse">Opponent's turn...</span>
        )}
      </div>

      {/* Online status bar */}
      <div className="flex items-center gap-2 shrink-0 text-[9px]">
        <span className="text-white/40">Room: <span className="text-amber-400 font-heading tracking-wider">{roomCode}</span></span>
        <span className="text-white/30">|</span>
        <span className="text-white/40">You: {playerLabel}</span>
        <span className="text-white/30">|</span>
        <span className={opponentConnected ? 'text-green-400' : 'text-red-400'}>
          {opponentConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Mobile: dice */}
      <div className="lg:hidden flex items-center justify-center gap-2 shrink-0">
        <DiceArea
          dice={state.dice} phase={state.phase} currentPlayer={state.currentPlayer}
          onRoll={roll}
          awaitingJokerChoice={awaitingJokerChoice && isMyTurn}
          onChooseJokerDoubles={chooseJokerDoubles}
          isAITurn={!isMyTurn}
        />
      </div>

      {/* Main layout */}
      <div className="flex gap-3 items-start w-full max-w-[1250px] justify-center flex-1">
        <div className="hidden lg:flex flex-col gap-3 w-[200px] shrink-0">
          <MoveLog entries={state.moveLog} />
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
            awaitingJokerChoice={awaitingJokerChoice && isMyTurn}
            onChooseJokerDoubles={chooseJokerDoubles}
            isAITurn={!isMyTurn}
          />
          {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
          <button onClick={() => setHintsEnabled(h => !h)}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer">
            Hints: {hintsEnabled ? 'ON' : 'OFF'}
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
        <button onClick={() => setShowMobileLog(v => !v)}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap">
          {showMobileLog ? 'Hide Log' : 'Log'}
        </button>
      </div>

      {showMobileLog && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 max-h-[40vh] z-40 overflow-y-auto rounded-xl shadow-2xl">
          <MoveLog entries={state.moveLog} />
        </div>
      )}

      {/* Victory */}
      {state.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-board-bg border-4 border-stone-border rounded-2xl p-6 lg:p-8 text-center shadow-2xl max-w-md mx-4">
            <div className="text-5xl lg:text-6xl mb-4">{state.winner === 1 ? '☀' : '☽'}</div>
            <h2 className="font-heading text-2xl lg:text-3xl text-highlight-selected mb-2">
              {GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!
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
  );
}
