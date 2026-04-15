import { useGame } from '../hooks/useGame';
import { GAME_CONFIG } from '../config/gameConfig';
import Board from './Board';
import DiceArea from './DiceArea';
import TurnIndicator from './TurnIndicator';
import MoveLog from './MoveLog';
import RulesPanel from './RulesPanel';
import GameControls from './GameControls';

export default function Game() {
  const { state, roll, selectMove, restart, validMoves, awaitingJokerChoice, chooseJokerDoubles, undo, canUndo } = useGame();

  return (
    <div className="h-screen flex flex-col items-center px-4 py-2 gap-1 overflow-hidden">
      {/* Logo */}
      <header>
        <img src="/logo.png" alt="STONE" className="h-28 object-contain" />
      </header>

      {/* Turn indicator */}
      <TurnIndicator
        currentPlayer={state.currentPlayer}
        phase={state.phase}
        winner={state.winner}
      />

      {/* Main layout: sidebar + board + sidebar */}
      <div className="flex gap-3 items-start w-full max-w-[1100px] justify-center flex-1 min-h-0">
        {/* Left sidebar: Move Log + Rules + New Game */}
        <div className="hidden lg:flex flex-col gap-3 w-[200px] shrink-0">
          <MoveLog entries={state.moveLog} />
          <RulesPanel />
          <GameControls onRestart={restart} />
        </div>

        {/* Board */}
        <div className="flex-1 max-w-[750px]">
          <Board
            state={state}
            validMoves={validMoves}
            onSelectMove={selectMove}
          />
        </div>

        {/* Right sidebar: Dice + Undo */}
        <div className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0 items-center">
          <DiceArea
            dice={state.dice}
            phase={state.phase}
            currentPlayer={state.currentPlayer}
            onRoll={roll}
            awaitingJokerChoice={awaitingJokerChoice}
            onChooseJokerDoubles={chooseJokerDoubles}
          />
          {canUndo && (
            <GameControls onUndo={undo} canUndo={canUndo} />
          )}
        </div>
      </div>

      {/* Mobile: dice and controls below board */}
      <div className="lg:hidden flex flex-col items-center gap-4">
        <DiceArea
          dice={state.dice}
          phase={state.phase}
          currentPlayer={state.currentPlayer}
          onRoll={roll}
        />
        <GameControls onRestart={restart} />
      </div>

      {/* Mobile: move log and rules below */}
      <div className="lg:hidden flex flex-col gap-3 w-full max-w-[500px]">
        <MoveLog entries={state.moveLog} />
        <RulesPanel />
      </div>

      {/* Victory overlay */}
      {state.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={restart}>
          <div className="bg-board-bg border-4 border-stone-border rounded-2xl p-8 text-center shadow-2xl max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl mb-4">
              {state.winner === 1 ? '☀' : '☽'}
            </div>
            <h2 className="font-heading text-3xl text-highlight-selected mb-2">
              {GAME_CONFIG.PLAYER_NAMES[state.winner]} Wins!
            </h2>
            <p className="text-stone-light/60 mb-6 text-sm">
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
