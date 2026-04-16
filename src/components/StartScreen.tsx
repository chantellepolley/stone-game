import { useState } from 'react';
import type { GameMode, AIDifficulty } from '../types/game';

interface StartScreenProps {
  onStart: (mode: GameMode, difficulty: AIDifficulty) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [showDifficulty, setShowDifficulty] = useState(false);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 sm:gap-8 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

      {!showDifficulty ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/60 text-sm font-heading tracking-wider">Choose how to play</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => onStart('pvp', 'medium')}
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-[#504840] text-white border-2 border-[#6b5f55]
                         hover:bg-[#5e5549] hover:scale-105 active:scale-95
                         transition-all cursor-pointer shadow-lg"
            >
              2 Players
            </button>
            <button
              onClick={() => setShowDifficulty(true)}
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-[#504840] text-white border-2 border-[#6b5f55]
                         hover:bg-[#5e5549] hover:scale-105 active:scale-95
                         transition-all cursor-pointer shadow-lg"
            >
              vs Computer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/60 text-sm font-heading tracking-wider">Select difficulty</p>
          <div className="flex gap-3">
            {([
              { level: 'easy' as AIDifficulty, label: 'Easy', desc: 'Random moves' },
              { level: 'medium' as AIDifficulty, label: 'Medium', desc: 'Smart strategy' },
              { level: 'hard' as AIDifficulty, label: 'Hard', desc: 'Looks ahead' },
            ]).map(({ level, label, desc }) => (
              <button
                key={level}
                onClick={() => onStart('ai', level)}
                className="px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-lg flex flex-col items-center gap-1"
              >
                <span>{label}</span>
                <span className="text-[10px] text-white/40 normal-case">{desc}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowDifficulty(false)}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
