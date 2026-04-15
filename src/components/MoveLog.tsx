import { useEffect, useRef } from 'react';
import type { MoveLogEntry } from '../types/game';

interface MoveLogProps {
  entries: MoveLogEntry[];
}

export default function MoveLog({ entries }: MoveLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="flex flex-col rounded-xl border border-stone-accent/30 bg-stone-bg/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-stone-accent/20 font-heading text-xs uppercase tracking-wider text-stone-light/50">
        Move Log
      </div>
      <div ref={scrollRef} className="move-log overflow-y-auto max-h-[240px] p-2 space-y-1">
        {entries.length === 0 && (
          <div className="text-xs text-stone-light/30 italic text-center py-4">
            No moves yet
          </div>
        )}
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`text-xs px-2 py-1 rounded ${
              entry.player === 1 ? 'text-player1/80' : 'text-player2/80'
            }`}
          >
            <span className="opacity-50 mr-1">T{entry.turn}</span>
            {entry.action}
          </div>
        ))}
      </div>
    </div>
  );
}
