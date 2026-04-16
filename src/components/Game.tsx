import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { GAME_CONFIG } from '../config/gameConfig';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import RulesPanel from './RulesPanel';
import GameControls from './GameControls';
import StartScreen from './StartScreen';

export default function Game() {
  const { state, roll, selectMove, restart, validMoves, awaitingJokerChoice, chooseJokerDoubles, undo, canUndo, startGame, isAITurn, pendingAIMove } = useGame();
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [showMobileLog, setShowMobileLog] = useState(false);

  if (state.phase === 'not_started') {
    return <StartScreen onStart={startGame} />;
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col items-center px-2 lg:px-4 py-1 lg:py-2 gap-1 lg:overflow-hidden">
      {/* Logo */}
      <header>
        <img src="/logo.png" alt="STONE" className="h-16 sm:h-20 lg:h-28 object-contain" />
      </header>

      {/* Turn indicator */}
      <div className="flex items-center gap-2">
        <TurnIndicator
          currentPlayer={state.currentPlayer}
          phase={state.phase}
          winner={state.winner}
        />
        {isAITurn && (
          <span className="text-[10px] lg:text-xs text-white/40 animate-pulse">AI thinking...</span>
        )}
      </div>

      {/* Mobile: dice above board */}
      <div className="lg:hidden flex flex-col items-center gap-1">
        <DiceArea
          dice={state.dice}
          phase={state.phase}
          currentPlayer={state.currentPlayer}
          onRoll={roll}
          awaitingJokerChoice={awaitingJokerChoice && !isAITurn}
          onChooseJokerDoubles={chooseJokerDoubles}
          isAITurn={isAITurn}
        />
      </div>

      {/* Main layout: sidebar + board + sidebar */}
      <div className="flex gap-3 items-start w-full max-w-[1250px] justify-center flex-1 min-h-0">
        {/* Left sidebar: Move Log + Rules + New Game (desktop) */}
        <div className="hidden lg:flex flex-col gap-3 w-[200px] shrink-0">
          <MoveLog entries={state.moveLog} />
          <RulesPanel />
          <GameControls onRestart={restart} />
        </div>

        {/* Board */}
        <div className="flex-1 max-w-[1050px] w-full">
          <Board
            state={state}
            validMoves={isAITurn ? [] : validMoves}
            onSelectMove={selectMove}
            pendingAIMove={pendingAIMove}
            hintsEnabled={hintsEnabled}
          />
        </div>

        {/* Right sidebar: Dice + Undo + Hints toggle (desktop) */}
        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center">
          <DiceArea
            dice={state.dice}
            phase={state.phase}
            currentPlayer={state.currentPlayer}
            onRoll={roll}
            awaitingJokerChoice={awaitingJokerChoice && !isAITurn}
            onChooseJokerDoubles={chooseJokerDoubles}
            isAITurn={isAITurn}
          />
          {canUndo && (
            <GameControls onUndo={undo} canUndo={canUndo} />
          )}
          {/* Hints toggle */}
          <button
            onClick={() => setHintsEnabled(h => !h)}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Hints: {hintsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Mobile: controls below board */}
      <div className="lg:hidden flex items-center gap-2 py-1 flex-wrap justify-center">
        {canUndo && <GameControls onUndo={undo} canUndo={canUndo} />}
        <GameControls onRestart={restart} />
        <button
          onClick={() => setHintsEnabled(h => !h)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md"
        >
          Hints: {hintsEnabled ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setShowMobileLog(v => !v)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     transition-all cursor-pointer shadow-md"
        >
          {showMobileLog ? 'Hide Log' : 'Show Log'}
        </button>
      </div>

      {/* Mobile: move log (toggleable) */}
      {showMobileLog && (
        <div className="lg:hidden w-full max-w-[500px] pb-2">
          <MoveLog entries={state.moveLog} />
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
              {GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!
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
