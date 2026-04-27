import { useState, useRef, useCallback, useEffect } from 'react';
import type { GameState, Move, PlayerId, Piece as PieceType } from '../types/game';
import { getSpaceVariant } from '../utils/boardLayout';
import { useIsMobile } from '../hooks/useIsMobile';
import BoardSpace from './BoardSpace';
import StoneBox from './StoneBox';
import Jail from './Jail';
import Piece from './Piece';

interface BoardProps {
  state: GameState;
  validMoves: Move[];
  onSelectMove: (move: Move) => void;
  pendingAIMove?: Move | null;
  hintsEnabled?: boolean;
  /** Which player "you" are — this player's row is always on the bottom */
  myPlayer?: PlayerId;
}

type SelectedSource =
  | { type: 'board'; index: number; pieceId: string }
  | { type: 'jail'; pieceId: string }
  | { type: 'bench'; player: PlayerId }
  | null;

interface AnimState {
  piece: PieceType;
  fromX: number; fromY: number;
  toX: number; toY: number;
  phase: 'start' | 'moving';
}

interface DragState {
  pieceId: string;
  piece: PieceType;
  x: number; y: number;
  fromKey: string;
}

const ANIM_MS = 350;

export default function Board({ state, validMoves, onSelectMove, pendingAIMove, hintsEnabled = true, myPlayer }: BoardProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<SelectedSource>(null);
  const [anim, setAnim] = useState<AnimState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Mobile: toggle for crowned vs uncrowned when mixed on same space
  const [mobileCrownedToggle, setMobileCrownedToggle] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingMove = useRef<Move | null>(null);
  const selectionTime = useRef<number>(0); // debounce guard for mobile double-tap

  const setRef = useCallback((key: string, el: HTMLDivElement | null) => { refs.current[key] = el; }, []);

  // ── Computed sets ──
  const validSourceSpaces = new Set<number>();
  const hasJailMoves = validMoves.some(m => m.from.type === 'jail');
  const hasBenchMoves = validMoves.some(m => m.from.type === 'bench');
  validMoves.forEach(m => { if (m.from.type === 'board') validSourceSpaces.add(m.from.index); });

  // Filter moves for the selected piece specifically
  const movesForSelected: Move[] = selected
    ? validMoves.filter(m => {
        if (selected.type === 'jail' && m.from.type === 'jail' && m.pieceId === selected.pieceId) return true;
        if (selected.type === 'bench' && m.from.type === 'bench') return true;
        if (selected.type === 'board' && m.from.type === 'board' && m.from.index === selected.index && m.pieceId === selected.pieceId) return true;
        return false;
      })
    : [];

  const targetSpaces = new Set<number>();
  let canBearOff = false;
  let hasWrapAroundMove = false;
  const selectedBoardIndex = selected?.type === 'board' ? selected.index : -1;
  movesForSelected.forEach(m => {
    if (m.to.type === 'board') {
      if (m.to.index === selectedBoardIndex) {
        hasWrapAroundMove = true; // Don't add to targetSpaces — handle separately
      } else {
        targetSpaces.add(m.to.index);
      }
    }
    if (m.to.type === 'home') canBearOff = true;
  });

  const anyBearOffP1 = !selected && state.currentPlayer === 1 && validMoves.some(m => m.to.type === 'home');
  const anyBearOffP2 = !selected && state.currentPlayer === 2 && validMoves.some(m => m.to.type === 'home');

  // ── Position helper ──
  function getCenter(key: string) {
    const el = refs.current[key]; const b = boardRef.current;
    if (!el || !b) return null;
    const br = b.getBoundingClientRect(); const er = el.getBoundingClientRect();
    return { x: er.left - br.left + er.width / 2, y: er.top - br.top + er.height / 2 };
  }

  // ── AI move animation ──
  useEffect(() => {
    if (pendingAIMove) {
      animateMove(pendingAIMove, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAIMove]);

  // ── Two-frame animation ──
  useEffect(() => {
    if (anim?.phase === 'start') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnim(prev => prev ? { ...prev, phase: 'moving' } : null);
        });
      });
    }
  }, [anim?.phase]);

  useEffect(() => {
    if (anim?.phase === 'moving') {
      const t = setTimeout(() => {
        setAnim(null);
        if (pendingMove.current) {
          onSelectMove(pendingMove.current);
          pendingMove.current = null;
        }
      }, ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [anim?.phase, onSelectMove]);

  function animateMove(move: Move, isAI = false) {
    let piece: PieceType | undefined;
    if (move.from.type === 'board') piece = state.board[move.from.index].find(p => p.id === move.pieceId);
    else if (move.from.type === 'bench') piece = state.bench[state.currentPlayer].find(p => p.id === move.pieceId);
    else if (move.from.type === 'jail') piece = state.jail[state.currentPlayer].find(p => p.id === move.pieceId);

    const fromKey = move.from.type === 'board' ? `space-${move.from.index}` : move.from.type === 'bench' ? `bench-${state.currentPlayer}` : 'jail';
    const toKey = move.to.type === 'board' ? `space-${move.to.index}` : `home-${state.currentPlayer}`;
    const from = getCenter(fromKey); const to = getCenter(toKey);

    if (!piece || !from || !to) { if (!isAI) onSelectMove(move); return; }
    // Only queue onSelectMove callback for human moves; AI handles its own state
    pendingMove.current = isAI ? null : move;
    setAnim({ piece, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, phase: 'start' });
  }

  // ── Drag and drop ──
  function handleDragStart(pieceId: string, e: React.PointerEvent) {
    const piece = findPiece(pieceId);
    if (!piece || busy) return;

    // Determine source: board space or bench
    const spaceIdx = state.board.findIndex(sp => sp.some(p => p.id === pieceId));
    let fromKey: string;
    if (spaceIdx !== -1) {
      setSelected({ type: 'board', index: spaceIdx, pieceId });
      fromKey = `space-${spaceIdx}`;
    } else {
      // Must be from bench
      setSelected({ type: 'bench', player: piece.owner });
      fromKey = `bench-${piece.owner}`;
    }

    const br = boardRef.current?.getBoundingClientRect();
    if (!br) return;
    setDrag({ pieceId, piece, x: e.clientX - br.left, y: e.clientY - br.top, fromKey });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!drag) return;
    const br = boardRef.current?.getBoundingClientRect();
    if (!br) return;
    setDrag(prev => prev ? { ...prev, x: e.clientX - br.left, y: e.clientY - br.top } : null);
  }

  function handleDragEnd(e: React.PointerEvent) {
    if (!drag) return;
    const br = boardRef.current?.getBoundingClientRect();
    if (!br) { setDrag(null); return; }

    const dropX = e.clientX; const dropY = e.clientY;
    let droppedMove: Move | null = null;

    // Find moves for the dragged piece specifically
    const dragMoves = validMoves.filter(m => m.pieceId === drag.pieceId);

    // Check all target spaces and home boxes
    for (const m of dragMoves) {
      const key = m.to.type === 'board' ? `space-${m.to.index}` : `home-${state.currentPlayer}`;
      const el = refs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (dropX >= r.left && dropX <= r.right && dropY >= r.top && dropY <= r.bottom) {
        droppedMove = m;
        break;
      }
    }

    setDrag(null);
    setSelected(null);
    if (droppedMove) {
      animateMove(droppedMove);
    }
  }

  function findPiece(id: string): PieceType | undefined {
    for (const sp of state.board) { const p = sp.find(p => p.id === id); if (p) return p; }
    for (const p of state.bench[1]) { if (p.id === id) return p; }
    for (const p of state.bench[2]) { if (p.id === id) return p; }
    return undefined;
  }

  // ── Click handlers ──
  const busy = !!anim || !!drag;

  /** Does this space have a mix of crowned and uncrowned player pieces? */
  function hasMixedCrownedPieces(index: number): boolean {
    const pp = state.board[index].filter(p => p.owner === state.currentPlayer);
    if (pp.length < 2) return false;
    const hasCrowned = pp.some(p => p.crowned);
    const hasUncrowned = pp.some(p => !p.crowned);
    return hasCrowned && hasUncrowned;
  }

  /** Pick the right piece from a space — handles mixed crowned/uncrowned via toggle on mobile */
  function pickPiece(index: number): PieceType | null {
    const playerPieces = state.board[index].filter(p => p.owner === state.currentPlayer);
    if (playerPieces.length === 0) return null;

    if (hasMixedCrownedPieces(index) && isMobile) {
      // Mobile: use toggle to decide crowned vs uncrowned
      const target = mobileCrownedToggle
        ? playerPieces.find(p => p.crowned)
        : playerPieces.find(p => !p.crowned);
      return target || playerPieces[playerPieces.length - 1];
    }

    return playerPieces[playerPieces.length - 1]; // top piece
  }

  const handleClickSpace = (index: number) => {
    if (busy) return;

    // Tapping the already-selected space → deselect
    if (selected?.type === 'board' && selected.index === index) {
      setSelected(null);
      return;
    }

    // Click a target → execute move (never same-space — those use the button)
    if (selected && targetSpaces.has(index)) {
      const tooSoon = Date.now() - selectionTime.current < 300;
      if (!tooSoon) {
        const move = movesForSelected.find(m => m.to.type === 'board' && m.to.index === index);
        if (move) { animateMove(move); setSelected(null); return; }
      }
    }

    // Click a source space → auto-select piece
    if (validSourceSpaces.has(index)) {
      const piece = pickPiece(index);
      if (piece) {
        if (!isMobile && hasMixedCrownedPieces(index)) {
          // Desktop: show piece chooser
          setSelected({ type: 'board', index, pieceId: piece.id });
        } else {
          // Mobile & normal: auto-select
          setSelected({ type: 'board', index, pieceId: piece.id });
        }
        selectionTime.current = Date.now();
        return;
      }
    }

    // Tap anything else → deselect
    setSelected(null);
  };

  // handleClickPiece is ONLY called for mixed crowned/uncrowned piece selection.
  // All other clicks bubble to handleClickSpace.
  const handleClickPiece = (pieceId: string) => {
    if (busy) return;
    const spaceIdx = state.board.findIndex(sp => sp.some(p => p.id === pieceId));
    if (spaceIdx === -1) return;

    // Switch selection to this specific piece (only happens for mixed crowned/uncrowned)
    const piece = state.board[spaceIdx].find(p => p.id === pieceId);
    if (piece && piece.owner === state.currentPlayer) {
      setSelected({ type: 'board', index: spaceIdx, pieceId });
      selectionTime.current = Date.now();
    }
  };

  const handleClickJailPiece = (pieceId: string) => {
    if (busy) return;
    if (hasJailMoves) setSelected({ type: 'jail', pieceId });
  };

  const handleClickBench = (player: PlayerId) => {
    if (busy) return;
    if (hasBenchMoves && player === state.currentPlayer) setSelected({ type: 'bench', player });
  };

  const handleBearOff = (player: PlayerId) => {
    if (busy) return;
    if (canBearOff && player === state.currentPlayer) {
      const move = movesForSelected.find(m => m.to.type === 'home');
      if (move) { animateMove(move); setSelected(null); }
    }
  };

  // Put "your" row on the bottom.
  // Original layout: P1 row = top (spaces 0-9), P2 row = bottom (spaces 19-10).
  // We flip so that YOUR row is always on the bottom.
  const me = myPlayer || state.currentPlayer;
  // When me=1, we need to flip (move P1 from top to bottom)
  // When me=2, no flip needed (P2 is already on bottom)
  const flipped = me === 1;
  const topPlayer: PlayerId = flipped ? 2 : 1;
  const botPlayer: PlayerId = flipped ? 1 : 2;
  const topIndices = flipped
    ? Array.from({ length: 10 }, (_, i) => 19 - i) // P2's row on top
    : Array.from({ length: 10 }, (_, i) => i);       // P1's row on top (default)
  const bottomIndices = flipped
    ? Array.from({ length: 10 }, (_, i) => i)         // P1's row on bottom
    : Array.from({ length: 10 }, (_, i) => 19 - i);   // P2's row on bottom (default)

  // Diamond shape offsets
  // Top row: slopes up to center peak, then down → pushes spaces upward at middle
  // Bottom row: slopes down to center dip, then up → pushes spaces downward at middle
  // Together they form a diamond/eye shape
  const diamondOffset = (idx: number): number => {
    // Top row (rendered left to right as indices 0,1,2,3,4 | 5,6,7,8,9)
    // Negative = move up, Positive = move down
    const topOffsets: Record<number, number> = {
      0: 12, 1: 6, 2: 0, 3: -6, 4: -12,   // left half: start low, rise to peak
      5: -12, 6: -6, 7: 0, 8: 6, 9: 12,    // right half: peak, descend back down
    };
    // Bottom row (rendered left to right as indices 19,18,17,16,15 | 14,13,12,11,10)
    // Needs to go OPPOSITE: start high, dip at center, rise back up
    const botOffsets: Record<number, number> = {
      19: -12, 18: -6, 17: 0, 16: 6, 15: 12,  // left half: start high, dip down
      14: 12, 13: 6, 12: 0, 11: -6, 10: -12,  // right half: dip, rise back up
    };

    return topOffsets[idx] ?? botOffsets[idx] ?? 0;
  };

  function renderSpace(idx: number) {
    const yOffset = diamondOffset(idx);
    return (
      <div key={idx} ref={el => setRef(`space-${idx}`, el)} className="min-w-0 h-full" style={{ transform: `translateY(${yOffset}px)` }}>
        <BoardSpace
          index={idx}
          pieces={state.board[idx]}
          variant={getSpaceVariant(idx)}
          isValidSource={!selected && !busy && validSourceSpaces.has(idx)}
          isValidTarget={!!selected && targetSpaces.has(idx)}
          hintsEnabled={hintsEnabled}
          isMobile={isMobile}
          isSelected={selected?.type === 'board' && selected.index === idx}
          selectedPieceId={selected?.type === 'board' && selected.index === idx ? selected.pieceId : null}
          currentPlayer={state.currentPlayer}
          onClickSpace={() => handleClickSpace(idx)}
          onClickPiece={handleClickPiece}
          onDragStart={isMobile ? undefined : handleDragStart}
        />
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      className="relative flex flex-col gap-0 rounded-xl lg:rounded-2xl border-2 lg:border-4 border-stone-border bg-board-bg p-1.5 sm:p-2 lg:p-3 shadow-2xl select-none h-full max-h-full"
      style={{
        background: isMobile
          ? 'linear-gradient(135deg, #4a4440 0%, #3d3835 50%, #4a4440 100%)'
          : 'linear-gradient(135deg, #3d3632 0%, #322d28 50%, #3d3632 100%)',
        boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        touchAction: isMobile ? 'auto' : 'none',
      }}
      onPointerMove={isMobile ? undefined : handleDragMove}
      onPointerUp={isMobile ? undefined : handleDragEnd}
    >
      {/* Top row arrows (opponent returns right-to-left here) */}
      <div className="flex items-center px-12 lg:px-16 h-3">
        <div className="flex-1 flex items-center justify-center gap-1">
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M12 1 L4 4 L12 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 h-px bg-amber-400/10" />
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M12 1 L4 4 L12 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 h-px bg-amber-400/10" />
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M12 1 L4 4 L12 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>

      {/* Top row (opponent's row) */}
      <div className="flex gap-0.5 lg:gap-1 items-stretch" style={{ height: 'clamp(80px, 18dvh, 220px)' }}>
        <div ref={el => setRef(`bench-${topPlayer}`, el)} className="h-full" style={{ transform: 'translateY(12px)' }}>
          <StoneBox player={topPlayer} pieces={state.bench[topPlayer]} label="Start"
            interactive={!selected && !busy && hasBenchMoves && state.currentPlayer === topPlayer}
            currentPlayer={state.currentPlayer} hintsEnabled={hintsEnabled}
            onClick={() => handleClickBench(topPlayer)}
            isSelected={selected?.type === 'bench' && selected.player === topPlayer}
            onDragStart={!isMobile && hasBenchMoves && state.currentPlayer === topPlayer ? handleDragStart : undefined}
          />
        </div>

        <div className="grid gap-0.5 lg:gap-1 flex-1 h-full" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {topIndices.map((idx, i) =>
            i === 5
              ? [<div key="div-top" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />, renderSpace(idx)]
              : renderSpace(idx)
          )}
        </div>

        <div ref={el => setRef(`home-${topPlayer}`, el)} className="h-full" style={{ transform: 'translateY(12px)' }}>
          <StoneBox player={topPlayer} pieces={state.home[topPlayer]} label="Home"
            interactive={!busy && canBearOff && state.currentPlayer === topPlayer}
            hinting={hintsEnabled && (topPlayer === 1 ? anyBearOffP1 : anyBearOffP2)} currentPlayer={state.currentPlayer} hintsEnabled={hintsEnabled}
            onClick={() => handleBearOff(topPlayer)}
          />
        </div>
      </div>

      {/* Jail + vertical wrap-around arrows at the edges */}
      <div className="flex items-center justify-center py-0.5 lg:py-1 px-1 relative max-h-[80px] lg:max-h-[110px]">
        {/* Left arrow: down (pieces wrap from top-left down to bottom-left) */}
        <div className="absolute left-1 lg:left-2 top-1/2 -translate-y-1/2">
          <svg width="14" height="28" viewBox="0 0 14 28" className="text-amber-400/25">
            <path d="M7 2 L7 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 18 L7 24 L11 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div ref={el => setRef('jail', el)}>
          <Jail jail={state.jail} validMoves={busy ? [] : validMoves}
            onClickJailPiece={handleClickJailPiece} currentPlayer={state.currentPlayer} />
        </div>

        {/* Right arrow: up (pieces wrap from bottom-right up to top-right) */}
        <div className="absolute right-1 lg:right-2 top-1/2 -translate-y-1/2">
          <svg width="14" height="28" viewBox="0 0 14 28" className="text-amber-400/25">
            <path d="M7 26 L7 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 10 L7 4 L11 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Bottom row arrows (your pieces move left-to-right) */}
      <div className="flex items-center px-12 lg:px-16 h-3">
        <div className="flex-1 flex items-center justify-center gap-1">
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M4 1 L12 4 L4 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 h-px bg-amber-400/10" />
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M4 1 L12 4 L4 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="flex-1 h-px bg-amber-400/10" />
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-amber-400/20"><path d="M4 1 L12 4 L4 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>

      {/* Bottom row (current player's row — always moves left to right here) */}
      <div className="flex gap-0.5 lg:gap-1 items-stretch" style={{ height: 'clamp(80px, 18dvh, 220px)' }}>
        <div ref={el => setRef(`bench-${botPlayer}`, el)} className="h-full" style={{ transform: 'translateY(-12px)' }}>
          <StoneBox player={botPlayer} pieces={state.bench[botPlayer]} label="Start"
            interactive={!selected && !busy && hasBenchMoves && state.currentPlayer === botPlayer}
            currentPlayer={state.currentPlayer} hintsEnabled={hintsEnabled}
            onClick={() => handleClickBench(botPlayer)}
            isSelected={selected?.type === 'bench' && selected.player === botPlayer}
            onDragStart={!isMobile && hasBenchMoves && state.currentPlayer === botPlayer ? handleDragStart : undefined}
          />
        </div>

        <div className="grid gap-0.5 lg:gap-1 flex-1 h-full" style={{ gridTemplateColumns: 'repeat(5, 1fr) 4px repeat(5, 1fr)' }}>
          {bottomIndices.map((idx, i) =>
            i === 5
              ? [<div key="div-bot" className="w-1 bg-stone-accent/40 rounded-full self-stretch" />, renderSpace(idx)]
              : renderSpace(idx)
          )}
        </div>

        <div ref={el => setRef(`home-${botPlayer}`, el)} className="h-full" style={{ transform: 'translateY(-12px)' }}>
          <StoneBox player={botPlayer} pieces={state.home[botPlayer]} label="Home"
            interactive={!busy && canBearOff && state.currentPlayer === botPlayer}
            hinting={hintsEnabled && (botPlayer === 1 ? anyBearOffP1 : anyBearOffP2)} currentPlayer={state.currentPlayer} hintsEnabled={hintsEnabled}
            onClick={() => handleBearOff(botPlayer)}
          />
        </div>
      </div>

      {/* Deselect + crowned toggle */}
      {selected && !busy && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1 rounded-lg text-[10px] font-heading uppercase tracking-wider
                       bg-[#504840] text-white/90 border border-[#6b5f55] hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg"
          >
            Deselect
          </button>
          {selected.type === 'board' && hasMixedCrownedPieces(selected.index) && (
            <button
              onClick={() => {
                setMobileCrownedToggle(prev => !prev);
                const pp = state.board[selected.index].filter(p => p.owner === state.currentPlayer);
                const next = !mobileCrownedToggle
                  ? pp.find(p => p.crowned)
                  : pp.find(p => !p.crowned);
                if (next) setSelected({ type: 'board', index: selected.index, pieceId: next.id });
              }}
              className="px-3 py-1 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer shadow-lg"
            >
              {mobileCrownedToggle ? 'Move Regular' : 'Move Crowned'}
            </button>
          )}
          {hasWrapAroundMove && (
            <button
              onClick={() => {
                const move = movesForSelected.find(m =>
                  m.to.type === 'board' && m.to.index === selectedBoardIndex
                );
                if (move) { animateMove(move); setSelected(null); }
              }}
              className="px-3 py-0.5 rounded text-[10px] font-heading uppercase tracking-wider
                         bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer"
            >
              Wrap Around
            </button>
          )}
        </div>
      )}

      <div className={selected ? '' : 'mt-1'}>
        <div className="h-0.5 bg-gradient-to-r from-transparent via-stone-accent/40 to-transparent" />
      </div>

      {/* Animated sliding piece */}
      {anim && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: anim.fromX - 22,
            top: anim.fromY - 22,
            width: 44, height: 44,
            transform: anim.phase === 'moving'
              ? `translate(${anim.toX - anim.fromX}px, ${anim.toY - anim.fromY}px)`
              : 'translate(0, 0)',
            transition: anim.phase === 'moving' ? `transform ${ANIM_MS}ms ease-out` : 'none',
          }}
        >
          <Piece piece={anim.piece} size="md" />
        </div>
      )}

      {/* Dragging piece */}
      {drag && (
        <div
          className="absolute z-50 pointer-events-none opacity-80"
          style={{ left: drag.x - 22, top: drag.y - 22, width: 44, height: 44 }}
        >
          <Piece piece={drag.piece} size="md" />
        </div>
      )}
    </div>
  );
}
