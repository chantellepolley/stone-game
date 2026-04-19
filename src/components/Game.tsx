import { useState, useRef, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import { setSoundEnabled, isSoundEnabled, playYourTurnSound } from '../utils/sounds';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import RulesPanel from './RulesPanel';
import GameControls from './GameControls';
import StartScreen from './StartScreen';

interface GameProps {
  onPlayOnline?: () => void;
  onShowStats?: () => void;
  onShowLeaderboard?: () => void;
  onShowMyGames?: () => void;
  onShowColors?: () => void;
  onShowFriends?: () => void;
  pendingNotifications?: number;
  resumeGameId?: string | null;
  onShowTerms?: () => void;
  onShowPrivacy?: () => void;
  onShowFeedback?: () => void;
  onShowTutorial?: () => void;
  onShowAdminFeedback?: () => void;
}

export default function Game({ onPlayOnline, onShowStats, onShowLeaderboard, onShowMyGames, onShowColors, onShowFriends, pendingNotifications, resumeGameId, onShowTerms, onShowPrivacy, onShowFeedback, onShowTutorial, onShowAdminFeedback }: GameProps) {
  const { state, roll, selectMove, restart, validMoves, awaitingJesterChoice, chooseJesterDoubles, undo, canUndo, startGame, isAITurn, pendingAIMove, aiRolling, loadGame } = useGame();

  // Resume a saved game from My Games (only if resumeGameId is set and game is not_started)
  const [hasResumed, setHasResumed] = useState(false);
  useEffect(() => {
    if (resumeGameId && !hasResumed && state.phase === 'not_started') {
      setHasResumed(true);
      loadGame(resumeGameId);
    }
  }, [resumeGameId, hasResumed, loadGame, state.phase]);
  const { player } = usePlayerContext();
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [showMobileRules, setShowMobileRules] = useState(false);

  // Show rules automatically on first ever game
  const [showFirstTimeRules, setShowFirstTimeRules] = useState(() => {
    if (localStorage.getItem('stone_has_played')) return false;
    return true;
  });
  useEffect(() => {
    if (state.phase === 'rolling' && showFirstTimeRules) {
      // Player started their first game — they'll see rules overlay
    }
    if (state.phase !== 'not_started' && !localStorage.getItem('stone_has_played')) {
      localStorage.setItem('stone_has_played', '1');
    }
  }, [state.phase, showFirstTimeRules]);
  const prevPlayer = useRef(state.currentPlayer);

  // Play "your turn" sound when it becomes your turn
  useEffect(() => {
    if (state.phase === 'rolling' && state.currentPlayer === 1 && prevPlayer.current !== 1 && state.gameMode !== 'pvp') {
      playYourTurnSound();
    }
    prevPlayer.current = state.currentPlayer;
  }, [state.currentPlayer, state.phase, state.gameMode]);

  if (state.phase === 'not_started') {
    return <StartScreen onStart={startGame} onPlayOnline={onPlayOnline} onShowStats={onShowStats} onShowLeaderboard={onShowLeaderboard} onShowMyGames={onShowMyGames} onShowColors={onShowColors} onShowFriends={onShowFriends} pendingNotifications={pendingNotifications} onShowTerms={onShowTerms} onShowPrivacy={onShowPrivacy} onShowFeedback={onShowFeedback} onShowTutorial={onShowTutorial} onShowAdminFeedback={onShowAdminFeedback} />;
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-0.5 lg:gap-1 overflow-y-auto overflow-x-hidden">
      {/* Logo — click to go home */}
      <header className="shrink-0 cursor-pointer" onClick={restart}>
        <img src="/logo.png" alt="STONE" className="h-12 sm:h-16 lg:h-28 object-contain" />
      </header>

      {/* Turn indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <TurnIndicator
          currentPlayer={state.currentPlayer}
          phase={state.phase}
          winner={state.winner}
          player1Name={player?.username}
          player2Name={state.gameMode === 'ai' ? 'Computer' : undefined}
        />
        {isAITurn && (
          <span className="text-[10px] lg:text-xs text-white/40 animate-pulse">AI thinking...</span>
        )}
      </div>

      {/* Mobile: dice above board */}
      <div className="lg:hidden flex items-center justify-center gap-2 shrink-0">
        <DiceArea
          dice={state.dice}
          phase={state.phase}
          currentPlayer={state.currentPlayer}
          onRoll={roll}
          awaitingJesterChoice={awaitingJesterChoice && !isAITurn}
          onChooseJesterDoubles={chooseJesterDoubles}
          isAITurn={isAITurn}
          externalRolling={aiRolling}
        />
      </div>

      {/* Main layout: sidebar + board + sidebar — this section shrinks */}
      <div className="flex gap-3 items-start w-full max-w-[1250px] justify-center flex-1">
        {/* Left sidebar (desktop) */}
        <div className="hidden lg:flex flex-col gap-3 w-[200px] shrink-0">
          <MoveLog entries={state.moveLog} />
          <RulesPanel />
          <GameControls onRestart={restart} />
          <div className="text-[9px] text-white/30 text-center mt-auto">
            © 2026 Stone The Game. All rights reserved.
          </div>
        </div>

        {/* Board — shrinks to fit */}
        <div className="flex-1 max-w-[1050px] w-full min-h-0">
          <Board
            state={state}
            validMoves={isAITurn ? [] : validMoves}
            onSelectMove={selectMove}
            pendingAIMove={pendingAIMove}
            hintsEnabled={hintsEnabled}
          />
        </div>

        {/* Right sidebar (desktop) */}
        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center">
          <DiceArea
            dice={state.dice}
            phase={state.phase}
            currentPlayer={state.currentPlayer}
            onRoll={roll}
            awaitingJesterChoice={awaitingJesterChoice && !isAITurn}
            onChooseJesterDoubles={chooseJesterDoubles}
            isAITurn={isAITurn}
            externalRolling={aiRolling}
          />
          {canUndo && (
            <GameControls onUndo={undo} canUndo={canUndo} />
          )}
          <button
            onClick={() => setHintsEnabled(h => !h)}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Hints: {hintsEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Sound: {soundOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Mobile: bottom bar — always pinned */}
      <div className="lg:hidden flex items-center gap-1 py-0.5 shrink-0">
        {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
        <GameControls onRestart={restart} />
        <button
          onClick={() => setHintsEnabled(h => !h)}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          Hints {hintsEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button
          onClick={() => { setShowMobileLog(v => !v); setShowMobileRules(false); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          {showMobileLog ? 'Hide Log' : 'Log'}
        </button>
        <button
          onClick={() => { setShowMobileRules(v => !v); setShowMobileLog(false); }}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md whitespace-nowrap"
        >
          {showMobileRules ? 'Hide Rules' : 'Rules'}
        </button>
      </div>

      {/* Copyright — mobile */}
      <div className="lg:hidden text-[8px] text-white/30 shrink-0">
        © 2026 Stone The Game. All rights reserved.
      </div>

      {/* Mobile: move log overlay */}
      {showMobileLog && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 max-h-[40vh] z-40 overflow-y-auto rounded-xl shadow-2xl">
          <MoveLog entries={state.moveLog} />
        </div>
      )}

      {/* Mobile: rules overlay */}
      {showMobileRules && (
        <div className="lg:hidden fixed bottom-10 left-2 right-2 max-h-[40vh] z-40 overflow-y-auto rounded-xl shadow-2xl">
          <RulesPanel defaultOpen />
        </div>
      )}

      {/* First-time tutorial prompt */}
      {showFirstTimeRules && !state.winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-md w-full text-center">
            <h2 className="text-white font-heading text-xl mb-2">New to STONE?</h2>
            <p className="text-white/60 text-sm mb-5">Take a quick interactive walkthrough to learn the basics, or jump right in!</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowFirstTimeRules(false); if (onShowTutorial) onShowTutorial(); }}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white border-2 border-amber-500
                           hover:bg-amber-500 hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-lg"
              >
                Play Tutorial
              </button>
              <button
                onClick={() => setShowFirstTimeRules(false)}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white border-2 border-[#6b5f55]
                           hover:bg-[#6b5f55] hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-lg"
              >
                Skip — I know how to play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory overlay */}
      {state.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={restart}>
          <div className="bg-board-bg border-4 border-stone-border rounded-2xl p-6 lg:p-8 text-center shadow-2xl max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl lg:text-6xl mb-4">
              {state.winner === 1 ? '☀' : '☽'}
            </div>
            <h2 className="font-heading text-2xl lg:text-3xl text-highlight-selected mb-2">
              {state.winner === 1 && player?.username
                ? `${player.username} Wins!`
                : state.winner === 2 && state.gameMode === 'ai'
                  ? 'Computer Wins!'
                  : `${GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!`}
            </h2>
            <p className="text-white/60 mb-4 lg:mb-6 text-sm">
              All stones have been borne off. The temple is sealed.
            </p>
            <button
              onClick={restart}
              className="px-6 py-3 rounded-lg font-heading text-sm uppercase tracking-wider
                         bg-highlight-selected text-stone-bg
                         hover:brightness-110 transition-all cursor-pointer shadow-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
