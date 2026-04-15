import { useState, useRef, useCallback } from 'react';
import type { GameState, Move, PlayerId, Piece as PieceType } from '../types/game';
import { getSpaceVariant } from '../utils/boardLayout';
import BoardSpace from './BoardSpace';
import StoneBox from './StoneBox';
import Jail from './Jail';
import Piece from './Piece';

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

interface AnimatingPiece {
  piece: PieceType;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const ANIM_DURATION = 400; // ms

export default function Board({ state, validMoves, onSelectMove }: BoardProps) {
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [animating, setAnimating] = useState<AnimatingPiece | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const spaceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setSpaceRef = useCallback((key: string, el: HTMLDivElement | null) => {
    spaceRefs.current[key] = el;
  }, []);

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

  const anyBearOffP1 = !selectedSource && state.currentPlayer === 1 && validMoves.some(m => m.to.type === 'home');
  const anyBearOffP2 = !selectedSource && state.currentPlayer === 2 && validMoves.some(m => m.to.type === 'home');

  /** Get the center position of a space/box element relative to the board container */
  function getPos(key: string): { x: number; y: number } | null {
    const el = spaceRefs.current[key];
    const board = boardRef.current;
    if (!el || !board) return null;
    const bRect = board.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return {
      x: eRect.left - bRect.left + eRect.width / 2,
      y: eRect.top - bRect.top + eRect.height / 2,
    };
  }

  /** Animate a piece from source to destination, then execute the move */
  function animateAndMove(move: Move) {
    // Find the piece being moved
    let piece: PieceType | undefined;
    if (move.from.type === 'board') {
      const pieces = state.board[move.from.index].filter(p => p.owner === state.currentPlayer);
      piece = pieces.find(p => p.id === move.pieceId);
    } else if (move.from.type === 'bench') {
      piece = state.bench[state.currentPlayer].find(p => p.id === move.pieceId);
    } else if (move.from.type === 'jail') {
      piece = state.jail[state.currentPlayer].find(p => p.id === move.pieceId);
    }
    if (!piece) { onSelectMove(move); return; }

    // Get positions
    const fromKey = move.from.type === 'board' ? `space-${move.from.index}`
      : move.from.type === 'bench' ? `bench-${state.currentPlayer}`
      : `jail`;
    const toKey = move.to.type === 'board' ? `space-${move.to.index}`
      : `home-${state.currentPlayer}`;

    const from = getPos(fromKey);
    const to = getPos(toKey);

    if (!from || !to) { onSelectMove(move); return; }

    setAnimating({ piece, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });

    setTimeout(() => {
      setAnimating(null);
      onSelectMove(move);
    }, ANIM_DURATION);
  }

  const handleClickSpace = (index: number) => {
    if (animating) return;
    if (selectedSource && validTargetSpaces.has(index)) {
      const move = movesFromSelected.find(m => m.to.type === 'board' && m.to.index === index);
      if (move) {
        animateAndMove(move);
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
    if (animating) return;
    const spaceIdx = state.board.findIndex(space => space.some(p => p.id === pieceId));
    if (spaceIdx !== -1 && validSourceSpaces.has(spaceIdx)) {
      setSelectedSource({ type: 'board', index: spaceIdx });
    }
  };

  const handleClickJailPiece = (pieceId: string) => {
    if (animating) return;
    if (hasJailMoves) {
      setSelectedSource({ type: 'jail', pieceId });
    }
  };

  const handleClickBench = (player: PlayerId) => {
    if (animating) return;
    if (hasBenchMoves && player === state.currentPlayer) {
      setSelectedSource({ type: 'bench', player });
    }
  };

  const handleBearOff = (player: PlayerId) => {
    if (animating) return;
    if (canBearOff && player === state.currentPlayer) {
      const move = movesFromSelected.find(m => m.to.type === 'home');
      if (move) {
        animateAndMove(move);
        setSelectedSource(null);
      }
    }
  };

  const topIndices = Array.from({ length: 10 }, (_, i) => i);
  const bottomIndices = Array.from({ length: 10 }, (_, i) => 19 - i);

  return (
    <div ref={boardRef} className="relative flex flex-col gap-0 rounded-2xl border-4 border-stone-border bg-board-bg p-3 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #3d3632 0%, #322d28 50%, #3d3632 100%)',
        boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Top row: P1 start | spaces 0-9 | P1 home */}
      <div className="flex gap-1 items-stretch" style={{ height: '220px' }}>
        <div ref={el => setSpaceRef('bench-1', el)}>
          <StoneBox
            player={1}
            pieces={state.bench[1]}
            label="Start"
            interactive={!selectedSource && !animating && hasBenchMoves && state.currentPlayer === 1}
            currentPlayer={state.currentPlayer}
            onClick={() => handleClickBench(1)}
            isSelected={selectedSource?.type === 'bench' && selectedSource.player === 1}
          />
        </div>

        <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {topIndices.map(idx => (
            idx === 5
              ? [
                  <div key="divider-top" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />,
                  <div key={idx} ref={el => setSpaceRef(`space-${idx}`, el)}>
                    <BoardSpace
                      index={idx}
                      pieces={state.board[idx]}
                      variant={getSpaceVariant(idx)}
                      isValidSource={!selectedSource && !animating && validSourceSpaces.has(idx)}
                      isValidTarget={validTargetSpaces.has(idx)}
                      isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                      currentPlayer={state.currentPlayer}
                      onClickSpace={() => handleClickSpace(idx)}
                      onClickPiece={handleClickPiece}
                    />
                  </div>
                ]
              : <div key={idx} ref={el => setSpaceRef(`space-${idx}`, el)}>
                  <BoardSpace
                    index={idx}
                    pieces={state.board[idx]}
                    variant={getSpaceVariant(idx)}
                    isValidSource={!selectedSource && !animating && validSourceSpaces.has(idx)}
                    isValidTarget={validTargetSpaces.has(idx)}
                    isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                    currentPlayer={state.currentPlayer}
                    onClickSpace={() => handleClickSpace(idx)}
                    onClickPiece={handleClickPiece}
                  />
                </div>
          ))}
        </div>

        <div ref={el => setSpaceRef('home-1', el)}>
          <StoneBox
            player={1}
            pieces={state.home[1]}
            label="Home"
            interactive={!animating && canBearOff && state.currentPlayer === 1}
            hinting={anyBearOffP1}
            currentPlayer={state.currentPlayer}
            onClick={() => handleBearOff(1)}
          />
        </div>
      </div>

      {/* Center: jail */}
      <div className="flex items-center justify-center py-2 px-1">
        <div ref={el => setSpaceRef('jail', el)}>
          <Jail
            jail={state.jail}
            validMoves={animating ? [] : validMoves}
            onClickJailPiece={handleClickJailPiece}
            currentPlayer={state.currentPlayer}
          />
        </div>
      </div>

      {/* Bottom row: P2 start | spaces 19-10 | P2 home */}
      <div className="flex gap-1 items-stretch" style={{ height: '220px' }}>
        <div ref={el => setSpaceRef('bench-2', el)}>
          <StoneBox
            player={2}
            pieces={state.bench[2]}
            label="Start"
            interactive={!selectedSource && !animating && hasBenchMoves && state.currentPlayer === 2}
            currentPlayer={state.currentPlayer}
            onClick={() => handleClickBench(2)}
            isSelected={selectedSource?.type === 'bench' && selectedSource.player === 2}
          />
        </div>

        <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {bottomIndices.map((idx, i) => (
            i === 5
              ? [
                  <div key="divider-bottom" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />,
                  <div key={idx} ref={el => setSpaceRef(`space-${idx}`, el)}>
                    <BoardSpace
                      index={idx}
                      pieces={state.board[idx]}
                      variant={getSpaceVariant(idx)}
                      isValidSource={!selectedSource && !animating && validSourceSpaces.has(idx)}
                      isValidTarget={validTargetSpaces.has(idx)}
                      isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                      currentPlayer={state.currentPlayer}
                      onClickSpace={() => handleClickSpace(idx)}
                      onClickPiece={handleClickPiece}
                    />
                  </div>
                ]
              : <div key={idx} ref={el => setSpaceRef(`space-${idx}`, el)}>
                  <BoardSpace
                    index={idx}
                    pieces={state.board[idx]}
                    variant={getSpaceVariant(idx)}
                    isValidSource={!selectedSource && !animating && validSourceSpaces.has(idx)}
                    isValidTarget={validTargetSpaces.has(idx)}
                    isSelected={selectedSource?.type === 'board' && selectedSource.index === idx}
                    currentPlayer={state.currentPlayer}
                    onClickSpace={() => handleClickSpace(idx)}
                    onClickPiece={handleClickPiece}
                  />
                </div>
          ))}
        </div>

        <div ref={el => setSpaceRef('home-2', el)}>
          <StoneBox
            player={2}
            pieces={state.home[2]}
            label="Home"
            interactive={!animating && canBearOff && state.currentPlayer === 2}
            hinting={anyBearOffP2}
            currentPlayer={state.currentPlayer}
            onClick={() => handleBearOff(2)}
          />
        </div>
      </div>

      {/* Decorative footer */}
      <div className="mt-2">
        <div className="h-0.5 bg-gradient-to-r from-transparent via-stone-accent/40 to-transparent" />
      </div>

      {/* Animated moving piece overlay */}
      {animating && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: animating.fromX - 22,
            top: animating.fromY - 22,
            width: 44,
            height: 44,
            transition: `all ${ANIM_DURATION}ms ease-in-out`,
            transform: `translate(${animating.toX - animating.fromX}px, ${animating.toY - animating.fromY}px)`,
          }}
        >
          <Piece piece={animating.piece} size="md" />
        </div>
      )}
    </div>
  );
}
