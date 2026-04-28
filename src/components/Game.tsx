import { useState, useRef, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { GAME_CONFIG } from '../config/gameConfig';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { AI_WAGER } from '../lib/coins';
import { awardGameBonuses, type BonusResult } from '../lib/bonuses';
import { setSoundEnabled, isSoundEnabled, playYourTurnSound } from '../utils/sounds';
import type { GameMode, AIDifficulty } from '../types/game';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import RulesPanel from './RulesPanel';
import GameControls from './GameControls';
import StartScreen from './StartScreen';
import JesterCoin from './JesterCoin';

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
  onShowAdminPlayers?: () => void;
  pushPermission?: NotificationPermission;
  onRequestPush?: () => void;
}

export default function Game({ onPlayOnline, onShowStats, onShowLeaderboard, onShowMyGames, onShowColors, onShowFriends, pendingNotifications, resumeGameId, onShowTerms, onShowPrivacy, onShowFeedback, onShowTutorial, onShowAdminFeedback, onShowAdminPlayers, pushPermission, onRequestPush }: GameProps) {
  const { state, roll, selectMove, restart, validMoves, awaitingJesterChoice, chooseJesterDoubles, undo, canUndo, startGame, isAITurn, pendingAIMove, aiRolling, loadGame } = useGame();
  const { spend, earn } = useCoins();
  const [currentWager, setCurrentWager] = useState(0);
  const wagerRef = useRef(0);
  const coinsAwarded = useRef(false);
  const [gameBonuses, setGameBonuses] = useState<BonusResult[]>([]);

  // Resume a saved game from My Games (only if resumeGameId is set and game is not_started)
  const [hasResumed, setHasResumed] = useState(false);
  useEffect(() => {
    if (resumeGameId && !hasResumed && state.phase === 'not_started') {
      setHasResumed(true);
      loadGame(resumeGameId);
    }
  }, [resumeGameId, hasResumed, loadGame, state.phase]);
  const { player } = usePlayerContext();

  // Handle starting an AI game with coin deduction
  const handleStart = async (mode: GameMode, difficulty: AIDifficulty, wager?: number) => {
    if (mode === 'ai') {
      const actualWager = wager ?? AI_WAGER[difficulty];
      if (actualWager > 0) {
        const ok = await spend(actualWager, `AI game wager (${difficulty})`);
        if (!ok) return;
      }
      setCurrentWager(actualWager);
      wagerRef.current = actualWager;
      coinsAwarded.current = false;
    } else {
      setCurrentWager(0);
      coinsAwarded.current = false;
    }
    startGame(mode, difficulty);
  };

  // Award coins + bonuses on AI game end
  useEffect(() => {
    if (state.phase === 'game_over' && state.winner && state.gameMode === 'ai' && !coinsAwarded.current) {
      coinsAwarded.current = true;
      const wager = wagerRef.current;
      const isWin = state.winner === 1;
      if (isWin && wager > 0) {
        earn(wager * 2, `AI game win (${state.aiDifficulty})`);
      }
      // Award bonuses (win or loss — handles streak reset on loss)
      if (player) {
        awardGameBonuses(player.id, state, state.winner, isWin).then(bonuses => {
          setGameBonuses(bonuses);
        });
      }
    }
  }, [state.phase, state.winner, state.gameMode, earn, player]);

  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  const handleForfeit = async () => {
    setShowForfeitConfirm(false);
    // Coins already deducted at start, nothing to refund — just end the game
    handleRestart();
  };

  // Reset coins tracking when going back to start
  const handleRestart = () => {
    setCurrentWager(0);
    wagerRef.current = 0;
    coinsAwarded.current = false;
    setGameBonuses([]);
    restart();
  };
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
    return <StartScreen onStart={handleStart} onPlayOnline={onPlayOnline} onShowStats={onShowStats} onShowLeaderboard={onShowLeaderboard} onShowMyGames={onShowMyGames} onShowColors={onShowColors} onShowFriends={onShowFriends} pendingNotifications={pendingNotifications} onShowTerms={onShowTerms} onShowPrivacy={onShowPrivacy} onShowFeedback={onShowFeedback} onShowTutorial={onShowTutorial} onShowAdminFeedback={onShowAdminFeedback} onShowAdminPlayers={onShowAdminPlayers} pushPermission={pushPermission} onRequestPush={onRequestPush} />;
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-0.5 lg:gap-1 overflow-y-auto overflow-x-hidden">
      {/* Logo + Home button */}
      <header className="shrink-0 flex items-center gap-2">
        <img src="/logo.png" alt="STONE" className="h-12 sm:h-16 lg:h-28 object-contain cursor-pointer" onClick={handleRestart} />
        <button onClick={handleRestart}
          className="px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white/70 border border-[#6b5f55] hover:text-white hover:bg-[#5e5549]
                     cursor-pointer transition-colors shadow-md">
          Home
        </button>
      </header>

      {/* Turn indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <TurnIndicator
          currentPlayer={state.currentPlayer}
          phase={state.phase}
          winner={state.winner}
          player1Name={player?.username}
          player2Name={state.gameMode === 'ai' ? `Computer (${(state.aiDifficulty || 'medium').charAt(0).toUpperCase() + (state.aiDifficulty || 'medium').slice(1)})` : undefined}
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
          <GameControls onRestart={handleRestart} />
          {state.gameMode === 'ai' && state.phase !== 'game_over' && currentWager > 0 && (
            <button onClick={() => setShowForfeitConfirm(true)}
              className="w-full px-3 py-2 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-red-900/40 text-red-400 border border-red-800/40 hover:bg-red-900/60
                         cursor-pointer transition-colors">
              Forfeit (-{currentWager} <JesterCoin size={12} />)
            </button>
          )}
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
            myPlayer={1}
          />
        </div>

        {/* Right sidebar (desktop) */}
        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center z-10">
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
        <GameControls onRestart={handleRestart} />
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

      {/* No valid moves overlay */}
      {state.phase === 'no_moves' && (
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-40 animate-[slideIn_0.3s_ease-out]">
          <div className="bg-[#504840] border-2 border-red-600/50 rounded-xl px-6 py-3 shadow-2xl text-center">
            <p className="text-red-400 font-heading text-sm uppercase tracking-wider">No valid moves!</p>
            <p className="text-white/50 text-[10px] mt-1">Skipping turn...</p>
          </div>
        </div>
      )}

      {/* Forfeit confirmation */}
      {showForfeitConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-2">Forfeit Game?</h2>
            <p className="text-white/60 text-sm mb-4">You will lose your {currentWager} coin wager.</p>
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

      {/* Victory overlay */}
      {state.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={handleRestart}>
          <div className="bg-board-bg border-4 border-stone-border rounded-2xl p-6 lg:p-8 text-center shadow-2xl max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl lg:text-6xl mb-4">
              {state.winner === 1 ? '☀' : '☽'}
            </div>
            <h2 className="font-heading text-2xl lg:text-3xl text-highlight-selected mb-2">
              {state.winner === 1 && player?.username
                ? `${player.username} Wins!`
                : state.winner === 2 && state.gameMode === 'ai'
                  ? `Computer (${(state.aiDifficulty || 'medium').charAt(0).toUpperCase() + (state.aiDifficulty || 'medium').slice(1)}) Wins!`
                  : `${GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!`}
            </h2>
            <p className="text-white/60 mb-2 text-sm">
              All stones have been borne off. The temple is sealed.
            </p>
            {state.gameMode === 'ai' && currentWager > 0 && (
              <p className={`text-sm font-heading mb-2 ${state.winner === 1 ? 'text-green-400' : 'text-red-400'}`}>
                {state.winner === 1 ? `+${currentWager} coins won!` : `-${currentWager} coins lost`} <JesterCoin size={16} />
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
            <button
              onClick={handleRestart}
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
