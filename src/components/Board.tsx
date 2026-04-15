import { useState } from 'react';
import type { GameState, Move, PlayerId } from '../types/game';
import { getSpaceVariant } from '../utils/boardLayout';
import BoardSpace from './BoardSpace';
import StoneBox from './StoneBox';
import Jail from './Jail';

interface BoardProps {
  state: GameState;
  validMoves: Move[];
  onSelectMove: (move: Move) => void;
}

type SelectedSource =
  | { type: 'board'; index: number }
  | { type: 'jail'; pieceId: string }
  | { type: 'bench'; player: PlayerId }
  | null;

export default function Board({ state, validMoves, onSelectMove }: BoardProps) {
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);

  const validSourceSpaces = new Set<number>();
  const hasJailMoves = validMoves.some(m => m.from.type === 'jail');
  const hasBenchMoves = validMoves.some(m => m.from.type === 'bench');
  validMoves.forEach(m => {
    if (m.from.type === 'board') validSourceSpaces.add(m.from.index);
  });

  const movesFromSelected: Move[] = selectedSource
    ? validMoves.filter(m => {
        if (selectedSource.type === 'jail' && m.from.type === 'jail') return true;
        if (selectedSource.type === 'bench' && m.from.type === 'bench') return true;
        if (selectedSource.type === 'board' && m.from.type === 'board' && m.from.index === selectedSource.index) return true;
        return false;
      })
    : [];

  const validTargetSpaces = new Set<number>();
  let canBearOff = false;
  movesFromSelected.forEach(m => {
    if (m.to.type === 'board') validTargetSpaces.add(m.to.index);
    if (m.to.type === 'home') canBearOff = true;
  });

  // Check if ANY valid move is a bear-off (hint glow even before selecting a source)
  const anyBearOffP1 = state.currentPlayer === 1 && validMoves.some(m => m.to.type === 'home');
  const anyBearOffP2 = state.currentPlayer === 2 && validMoves.some(m => m.to.type === 'home');

  const handleClickSpace = (index: number) => {
    if (selectedSource && validTargetSpaces.has(index)) {
      const move = movesFromSelected.find(m => m.to.type === 'board' && m.to.index === index);
      if (move) {
        onSelectMove(move);
        setSelectedSource(null);
        return;
      }
    }
    if (validSourceSpaces.has(index)) {
      setSelectedSource({ type: 'board', index });
      return;
    }
    setSelectedSource(null);
  };

  const handleClickPiece = (pieceId: string) => {
    const spaceIdx = state.board.findIndex(space => space.some(p => p.id === pieceId));
    if (spaceIdx !== -1 && validSourceSpaces.has(spaceIdx)) {
      setSelectedSource({ type: 'board', index: spaceIdx });
    }
  };

  const handleClickJailPiece = (pieceId: string) => {
    if (hasJailMoves) {
      setSelectedSource({ type: 'jail', pieceId });
    }
  };

  const handleClickBench = (player: PlayerId) => {
    if (hasBenchMoves && player === state.currentPlayer) {
      setSelectedSource({ type: 'bench', player });
    }
  };

  const handleBearOff = (player: PlayerId) => {
    if (canBearOff && player === state.currentPlayer) {
      const move = movesFromSelected.find(m => m.to.type === 'home');
      if (move) {
        onSelectMove(move);
        setSelectedSource(null);
      }
    }
  };

  // Top row: 0-9 left to right
  const topIndices = Array.from({ length: 10 }, (_, i) => i);
  // Bottom row: 19-10 left to right (original order)
  const bottomIndices = Array.from({ length: 10 }, (_, i) => 19 - i);

  return (
    <div className="flex flex-col gap-0 rounded-2xl border-4 border-stone-border bg-board-bg p-3 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #3d3632 0%, #322d28 50%, #3d3632 100%)',
        boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Top row: P1 start | spaces 0-9 | P1 home */}
      <div className="flex gap-1 items-stretch" style={{ height: '190px' }}>
        <StoneBox
          player={1}
          pieces={state.bench[1]}
          label="Start"
          interactive={hasBenchMoves && state.currentPlayer === 1}
          currentPlayer={state.currentPlayer}
          onClick={() => handleClickBench(1)}
          isSelected={selectedSource?.type === 'bench' && selectedSource.player === 1}
        />

        <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {topIndices.map(idx => (
            idx === 5
              ? [
                  <div key="divider-top" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />,
                  <BoardSpace
                    key={idx}
                    index={idx}
                    pieces={state.board[idx]}
                    variant={getSpaceVariant(idx)}
                    isValidSource={validSourceSpaces.has(idx)}
                    isValidTarget={validTargetSpaces.has(idx)}
                    isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                    currentPlayer={state.currentPlayer}
                    onClickSpace={() => handleClickSpace(idx)}
                    onClickPiece={handleClickPiece}
                  />
                ]
              : <BoardSpace
                  key={idx}
                  index={idx}
                  pieces={state.board[idx]}
                  variant={getSpaceVariant(idx)}
                  isValidSource={validSourceSpaces.has(idx)}
                  isValidTarget={validTargetSpaces.has(idx)}
                  isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                  currentPlayer={state.currentPlayer}
                  onClickSpace={() => handleClickSpace(idx)}
                  onClickPiece={handleClickPiece}
                />
          ))}
        </div>

        <StoneBox
          player={1}
          pieces={state.home[1]}
          label="Home"
          interactive={canBearOff && state.currentPlayer === 1}
          hinting={anyBearOffP1}
          currentPlayer={state.currentPlayer}
          onClick={() => handleBearOff(1)}
        />
      </div>

      {/* Center: jail */}
      <div className="flex items-center justify-center py-2 px-1">
        <Jail
          jail={state.jail}
          validMoves={validMoves}
          onClickJailPiece={handleClickJailPiece}
          currentPlayer={state.currentPlayer}
        />
      </div>

      {/* Bottom row: P2 start | spaces 19-10 | P2 home */}
      <div className="flex gap-1 items-stretch" style={{ height: '190px' }}>
        <StoneBox
          player={2}
          pieces={state.bench[2]}
          label="Start"
          interactive={hasBenchMoves && state.currentPlayer === 2}
          currentPlayer={state.currentPlayer}
          onClick={() => handleClickBench(2)}
          isSelected={selectedSource?.type === 'bench' && selectedSource.player === 2}
        />

        <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {bottomIndices.map((idx, i) => (
            i === 5
              ? [
                  <div key="divider-bottom" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />,
                  <BoardSpace
                    key={idx}
                    index={idx}
                    pieces={state.board[idx]}
                    variant={getSpaceVariant(idx)}
                    isValidSource={validSourceSpaces.has(idx)}
                    isValidTarget={validTargetSpaces.has(idx)}
                    isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                    currentPlayer={state.currentPlayer}
                    onClickSpace={() => handleClickSpace(idx)}
                    onClickPiece={handleClickPiece}
                  />
                ]
              : <BoardSpace
                  key={idx}
                  index={idx}
                  pieces={state.board[idx]}
                  variant={getSpaceVariant(idx)}
                  isValidSource={validSourceSpaces.has(idx)}
                  isValidTarget={validTargetSpaces.has(idx)}
                  isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                  currentPlayer={state.currentPlayer}
                  onClickSpace={() => handleClickSpace(idx)}
                  onClickPiece={handleClickPiece}
                />
          ))}
        </div>

        <StoneBox
          player={2}
          pieces={state.home[2]}
          label="Home"
          interactive={canBearOff && state.currentPlayer === 2}
          hinting={anyBearOffP2}
          currentPlayer={state.currentPlayer}
          onClick={() => handleBearOff(2)}
        />
      </div>

      {/* Decorative footer */}
      <div className="mt-2">
        <div className="h-0.5 bg-gradient-to-r from-transparent via-stone-accent/40 to-transparent" />
      </div>
    </div>
  );
}
