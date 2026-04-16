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
        {/* Left sidebar: Move Log + Rules + New Game */}
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
          />
        </div>

        {/* Right sidebar: Dice + Undo (desktop only) */}
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
        </div>
      </div>

      {/* Mobile: controls below board */}
      <div className="lg:hidden flex items-center gap-2 py-1">
        <GameControls onRestart={restart} onUndo={undo} canUndo={canUndo} />
      </div>

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
