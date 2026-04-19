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
          <p><strong>Starting:</strong> All stones begin in your starting area. Use a die value (1–5) to enter a stone onto the board — the value determines how far along your route it enters. You cannot enter with a 6 (Jester).</p>
          <p><strong>Movement:</strong> Each player travels 1.5 laps around the board (30 spaces total). You can use each die separately on different stones, or combine multiple dice to move one stone several steps.</p>
          <p><strong>Rolling:</strong> Roll 2 special dice with faces 1, 2, 3, 4, 5, and Jester (replaces the 6). Doubles grant 4 moves of that value.</p>
          <p><strong>Jester:</strong> Rolling a Jester with any number X gives you 4 moves of X. The Jester value (6) cannot be used to enter the board or bear off.</p>
          <p><strong>Double Jesters:</strong> You must first use a 1 and a 2 move. Then choose any doubles value (1–5) and get 4 additional moves of that value.</p>
          <p><strong>Capturing:</strong> Land on a space occupied by a single opponent stone to capture it — it goes to The Stoned Dungeon (jail). If a space has 2 or more opponent stones, you cannot land there. Multi-step moves can capture at intermediate spaces along the way.</p>
          <p><strong>Jail:</strong> You must re-enter all jailed stones before making any other moves. Jailed stones re-enter from the start of your route using a die value. Captured stones lose their crowned status.</p>
          <p><strong>Crowning:</strong> When a stone enters the home stretch (last 10 spaces of your route), it becomes crowned and displays the Jester symbol.</p>
          <p><strong>Bearing Off:</strong> Only crowned stones can bear off. An exact roll is needed to leave the board, unless ALL of your remaining board pieces are within the last 5 spaces — then any roll high enough will work, but you must bear off the farthest piece from home first.</p>
          <p><strong>Winning:</strong> First player to bear off all 13 stones wins!</p>
        </div>
      )}
    </div>
  );
}
