import { STONE_COLORS, type StoneColor } from '../utils/stoneColors';

interface ColorPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}

function ColorSwatch({ color, isSelected, onClick }: { color: StoneColor; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all cursor-pointer
        ${isSelected ? 'bg-white/10 ring-2 ring-white scale-105' : 'hover:bg-white/5'}`}
    >
      <div
        className="w-12 h-12 rounded-full shadow-lg"
        style={{
          backgroundImage: "url('/stone-bg.jpg')",
          backgroundSize: '80px',
          filter: 'brightness(1.3) contrast(1.1)',
          border: `3px solid ${color.border}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color.tint }} />
        <div className="absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.08)' }} />
      </div>
      <span className="text-[10px] text-white/60">{color.name}</span>
    </button>
  );
}

export default function ColorPicker({ selectedId, onSelect, onBack }: ColorPickerProps) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full">
        <p className="text-white font-heading text-lg">Choose Your Stone</p>

        <div className="grid grid-cols-4 gap-2">
          {STONE_COLORS.map(color => (
            <ColorSwatch
              key={color.id}
              color={color}
              isSelected={color.id === selectedId}
              onClick={() => onSelect(color.id)}
            />
          ))}
        </div>

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2">
          Back
        </button>
      </div>
    </div>
  );
}
