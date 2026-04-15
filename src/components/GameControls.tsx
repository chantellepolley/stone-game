interface GameControlsProps {
  onRestart: () => void;
}

export default function GameControls({ onRestart }: GameControlsProps) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onRestart}
        className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                   bg-stone-dark/50 text-stone-light/60 border border-stone-accent/30
                   hover:bg-stone-dark hover:text-stone-light transition-all cursor-pointer"
      >
        New Game
      </button>
    </div>
  );
}
