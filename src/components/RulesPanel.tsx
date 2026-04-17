import { useState } from 'react';

export default function RulesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[#6b5f55] bg-[#504840] overflow-hidden shadow-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between font-heading text-xs uppercase tracking-wider text-white hover:text-gray-300 transition-colors cursor-pointer"
      >
        <span>Rules</span>
        <span className="text-lg leading-none">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 text-xs text-stone-light/70 space-y-2 border-t border-stone-accent/20 pt-2">
          <p><strong>Goal:</strong> Be the first to bear off all 13 stones.</p>
          <p><strong>Starting:</strong> All stones begin in your starting area (left of your row). Use a die to enter a stone onto the board — the die value determines how far along your route it enters.</p>
          <p><strong>Movement:</strong> Each player travels 1.5 laps around the board (30 spaces). Sunstone goes right across the top, left across the bottom, then right across the top again to bear off at the top-right. Moonstone goes right across the bottom, left across the top, then right across the bottom again to bear off at the bottom-right.</p>
          <p><strong>Rolling:</strong> Roll 2 special dice (faces 1, 2, 3, 4, 5, and Jester instead of 6). Each die is a separate move. You can combine dice to move a single stone multiple steps. Doubles grant 4 moves.</p>
          <p><strong>Jester:</strong> The 6 face is a Jester. Rolling a Jester with any number X turns the roll into 4 moves of X. A value of 6 (Jester) cannot be used to enter or exit the board.</p>
          <p><strong>Double Jesters:</strong> You must first move a 1 and a 2. Then you choose any doubles value (1-5) and get 4 moves of it.</p>
          <p><strong>Capturing:</strong> Land on a space with a single opponent stone to capture it. Captured stones go to jail.</p>
          <p><strong>Jail:</strong> You must re-enter all jailed stones before making any other moves. Jailed stones re-enter from the start of your route.</p>
          <p><strong>Crowning:</strong> When a stone enters the final 10 spaces (home stretch), it becomes crowned and shows its jester symbol.</p>
          <p><strong>Bearing Off:</strong> Only crowned stones can bear off. An exact roll is needed unless ALL your remaining board pieces are in the last 5 spaces.</p>
          <p><strong>Winning:</strong> First player to bear off all 13 stones wins.</p>
        </div>
      )}
    </div>
  );
}
