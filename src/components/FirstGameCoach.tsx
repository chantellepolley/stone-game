import { useEffect, useState } from 'react';
import type { GameState } from '../types/game';

/**
 * Contextual coaching for a brand-new player's first guided game.
 * Only active when `stone_coach_pending` is set (from the guided first-run entry
 * points), so experienced players never see it. Retires once that game finishes.
 */
export default function FirstGameCoach({ state, isAITurn }: { state: GameState; isAITurn: boolean }) {
  const [active] = useState(() => localStorage.getItem('stone_coach_pending') === '1');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (active && state.phase === 'game_over') {
      localStorage.removeItem('stone_coach_pending');
      localStorage.setItem('stone_coach_done', '1');
    }
  }, [active, state.phase]);

  if (!active || dismissed || state.gameMode !== 'ai' || state.phase === 'game_over') return null;

  let tip = '';
  if (isAITurn) {
    tip = 'The computer is taking its turn. Watch how it moves!';
  } else if ((state.jail[1]?.length ?? 0) > 0 && state.phase === 'moving') {
    tip = 'One of your stones is in the Dungeon. Tap a glowing spot to bring it back in before your other moves.';
  } else if (state.phase === 'rolling') {
    tip = 'Your turn! Tap ROLL to roll the dice.';
  } else if (state.phase === 'moving') {
    tip = 'Tap a glowing stone, then tap where to send it. The glows show your options.';
  } else if (state.phase === 'no_moves') {
    tip = 'No moves are possible with this roll. Tap to pass your turn.';
  }
  if (!tip) return null;

  return (
    <div className="shrink-0 flex items-center gap-2 max-w-md w-full bg-amber-600/15 border border-amber-500/40 rounded-lg px-3 py-1.5 shadow animate-[slideIn_0.3s_ease-out]">
      <span className="text-base leading-none">&#128161;</span>
      <p className="text-amber-100/90 text-[11px] lg:text-xs leading-snug flex-1">{tip}</p>
      <button onClick={() => setDismissed(true)}
        aria-label="Dismiss tip"
        className="text-white/40 hover:text-white text-sm cursor-pointer px-1 leading-none">&times;</button>
    </div>
  );
}
