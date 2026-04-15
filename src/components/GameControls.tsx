interface GameControlsProps {
  onRestart?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export default function GameControls({ onRestart, onUndo, canUndo }: GameControlsProps) {
  return (
    <div className="flex justify-center gap-2">
      {canUndo && onUndo && (
        <button
          onClick={onUndo}
          className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                     bg-highlight-selected/20 text-highlight-selected border border-highlight-selected/40
                     hover:bg-highlight-selected/30 transition-all cursor-pointer"
        >
          Undo
        </button>
      )}
      {onRestart && (
        <button
          onClick={onRestart}
          className="px-4 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                     bg-[#504840] text-white border border-[#6b5f55]
                     hover:bg-[#5e5549] transition-all cursor-pointer shadow-md"
        >
          New Game
        </button>
      )}
    </div>
  );
}
