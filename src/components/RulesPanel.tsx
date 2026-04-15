import { useState } from 'react';

export default function RulesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-stone-accent/30 bg-stone-bg/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between font-heading text-xs uppercase tracking-wider text-stone-light/50 hover:text-stone-light/70 transition-colors cursor-pointer"
      >
        <span>Rules</span>
        <span className="text-lg leading-none">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 text-xs text-stone-light/70 space-y-2 border-t border-stone-accent/20 pt-2">
          <p><strong>Goal:</strong> Be the first to bear off all 13 stones.</p>
          <p><strong>Starting:</strong> All stones begin in your starting area (left of your row). Use a die to enter a stone onto the board — the die value determines how far along your route it enters.</p>
          <p><strong>Movement:</strong> Each player travels 1.5 laps around the board (30 spaces). Sunstone goes right across the top, left across the bottom, then right across the top again to bear off at the top-right. Moonstone goes right across the bottom, left across the top, then right across the bottom again to bear off at the bottom-right.</p>
          <p><strong>Rolling:</strong> Roll 2 dice (faces 1-5 + Joker). Each die is a separate move. Doubles grant 4 moves.</p>
          <p><strong>Joker:</strong> The 6 face is a Joker. Rolling a Joker with any number X turns the roll into 4 moves of X.</p>
          <p><strong>Double Jokers:</strong> You must first move a 1 and a 2. Then you choose any doubles value (1-5) and get 4 moves of it.</p>
          <p><strong>Capturing:</strong> Land on a space with a single opponent stone to capture it. Captured stones go to jail.</p>
          <p><strong>Jail:</strong> You must re-enter all jailed stones before making any other moves. Jailed stones re-enter from the start of your route.</p>
          <p><strong>Crowning:</strong> When a stone enters the final 5 spaces (home stretch), it becomes crowned and shows its jester symbol.</p>
          <p><strong>Bearing Off:</strong> Crowned stones that reach the end of the route are borne off (removed to your home pit).</p>
          <p><strong>Winning:</strong> First player to bear off all 13 stones wins.</p>
        </div>
      )}
    </div>
  );
}
