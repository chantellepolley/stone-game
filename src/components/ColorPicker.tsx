import { useState, useEffect } from 'react';
import { STONE_COLORS, CHAMPION_STONES, type StoneColor } from '../utils/stoneColors';
import { useCoins } from '../contexts/CoinsContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import { supabase } from '../lib/supabase';
import JesterCoin from './JesterCoin';

interface ColorPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const CHAMPION_CLIP = 'polygon(50% 0%, 65% 25%, 100% 15%, 75% 40%, 100% 50%, 75% 60%, 100% 85%, 65% 75%, 50% 100%, 35% 75%, 0% 85%, 25% 60%, 0% 50%, 25% 40%, 0% 15%, 35% 25%)';

function ColorSwatch({ color, isSelected, isOwned, onClick, locked }: { color: StoneColor; isSelected: boolean; isOwned: boolean; onClick: () => void; locked?: boolean }) {
  const isChampion = color.shape === 'sunburst';
  return (
    <button
      onClick={locked ? undefined : onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all relative
        ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${isSelected ? 'bg-white/10 ring-2 ring-white scale-105' : locked ? '' : 'hover:bg-white/5'}`}
    >
      {color.image ? (
        <img src={color.image} alt={color.name} className="w-12 h-12 object-contain" />
      ) : (
        <div
          className={`w-12 h-12 shadow-lg relative overflow-hidden ${isChampion ? '' : 'rounded-full'}`}
          style={{
            backgroundImage: "url('/stone-bg.jpg')",
            backgroundSize: '80px',
            filter: 'brightness(1.3) contrast(1.1)',
            border: isChampion ? 'none' : `3px solid ${color.border}`,
            clipPath: isChampion ? CHAMPION_CLIP : undefined,
            boxShadow: isChampion ? '0 0 10px rgba(255,200,0,0.3)' : undefined,
          }}
        >
          <div className={`absolute inset-0 ${isChampion ? '' : 'rounded-full'}`} style={
            color.gradient ? { background: color.gradient } : { backgroundColor: color.tint }
          } />
          <div className={`absolute inset-0 ${isChampion ? '' : 'rounded-full'}`}
            style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(255,255,255,0.08)' }} />
        </div>
      )}
      <span className="text-[10px] text-white/60">{color.name}</span>
      {color.premium && !isOwned && !isSelected && !color.champion && (
        <span className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-amber-600 text-white text-[7px] font-heading px-1 py-0.5 rounded-full">
          <JesterCoin size={8} /> {color.price}
        </span>
      )}
      {color.champion && !isOwned && (
        <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[6px] font-heading px-1 py-0.5 rounded-full">
          POTM
        </span>
      )}
    </button>
  );
}

export default function ColorPicker({ selectedId, onSelect, onBack }: ColorPickerProps) {
  const { coins, spend } = useCoins();
  const { player } = usePlayerContext();
  const [confirmColor, setConfirmColor] = useState<StoneColor | null>(null);
  const [owned, setOwned] = useState<string[]>([]);

  // Load owned colors from DB, merge with localStorage, sync both
  useEffect(() => {
    const loadOwned = async () => {
      // Start with localStorage
      let local: string[] = [];
      try { local = JSON.parse(localStorage.getItem('stone_owned_colors') || '[]'); } catch { /* */ }

      if (!player) { setOwned(local); return; }

      // Fetch from DB
      const { data } = await supabase
        .from('player_stats')
        .select('owned_colors')
        .eq('player_id', player.id)
        .single();

      const dbColors: string[] = data?.owned_colors || [];

      // Merge both (union)
      const merged = [...new Set([...local, ...dbColors])];
      setOwned(merged);

      // Sync back to both stores if there were differences
      if (merged.length > local.length) {
        localStorage.setItem('stone_owned_colors', JSON.stringify(merged));
      }
      if (merged.length > dbColors.length) {
        await supabase.from('player_stats').update({ owned_colors: merged }).eq('player_id', player.id);
      }
    };
    loadOwned();
  }, [player]);

  const handleColorClick = (color: StoneColor) => {
    if (color.premium && !owned.includes(color.id) && color.id !== selectedId) {
      setConfirmColor(color);
    } else {
      onSelect(color.id);
    }
  };

  const handlePurchase = async () => {
    if (!confirmColor || !confirmColor.price) return;
    const ok = await spend(confirmColor.price, `Unlocked ${confirmColor.name} stone color`);
    if (!ok) { setConfirmColor(null); return; }
    const updated = [...owned, confirmColor.id];
    setOwned(updated);
    localStorage.setItem('stone_owned_colors', JSON.stringify(updated));
    // Save to DB — both owned list and selected color
    if (player) {
      await supabase.from('player_stats').update({ owned_colors: updated, selected_color: confirmColor.id }).eq('player_id', player.id);
    }
    onSelect(confirmColor.id);
    setConfirmColor(null);
  };

  const freeColors = STONE_COLORS.filter(c => !c.premium);
  const premiumColors = STONE_COLORS.filter(c => c.premium && (c.price || 0) <= 25);
  const nflColors = STONE_COLORS.filter(c => c.premium && (c.price || 0) >= 50);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 px-4 py-4">
      <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer shrink-0" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full overflow-y-auto max-h-[75vh]">
        <p className="text-white font-heading text-lg">Choose Your Stone</p>

        <div className="grid grid-cols-4 gap-2">
          {freeColors.map(color => (
            <ColorSwatch
              key={color.id}
              color={color}
              isSelected={color.id === selectedId}
              isOwned={true}
              onClick={() => handleColorClick(color)}
            />
          ))}
        </div>

        {premiumColors.length > 0 && (
          <>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-amber-400/60 text-[10px] font-heading uppercase tracking-wider flex items-center gap-1">Premium <JesterCoin size={10} /></span>
              <div className="flex-1 h-px bg-white/20" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {premiumColors.map(color => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  isSelected={color.id === selectedId}
                  isOwned={owned.includes(color.id)}
                  onClick={() => handleColorClick(color)}
                />
              ))}
            </div>
          </>
        )}

        {nflColors.length > 0 && (
          <>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-amber-400/60 text-[10px] font-heading uppercase tracking-wider flex items-center gap-1">NFL Teams <JesterCoin size={10} /></span>
              <div className="flex-1 h-px bg-white/20" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {nflColors.map(color => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  isSelected={color.id === selectedId}
                  isOwned={owned.includes(color.id)}
                  onClick={() => handleColorClick(color)}
                />
              ))}
            </div>
          </>
        )}

        {/* Champion stones */}
        {CHAMPION_STONES.length > 0 && (
          <>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px bg-amber-400/30" />
              <span className="text-amber-400/80 text-[10px] font-heading uppercase tracking-wider">Champion Exclusive</span>
              <div className="flex-1 h-px bg-amber-400/30" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CHAMPION_STONES.map(color => {
                const isChampionOwned = owned.includes(color.id);
                return (
                  <ColorSwatch
                    key={color.id}
                    color={color}
                    isSelected={color.id === selectedId}
                    isOwned={isChampionOwned}
                    onClick={() => isChampionOwned && onSelect(color.id)}
                    locked={!isChampionOwned}
                  />
                );
              })}
            </div>
            <p className="text-white/30 text-[8px] text-center">Win Player of the Month to unlock these exclusive champion stones</p>
          </>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2 shrink-0">
          Back
        </button>
      </div>

      {/* Purchase confirmation */}
      {confirmColor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-2">Unlock {confirmColor.name}?</h2>
            <div className="flex justify-center mb-3">
              <div
                className="w-16 h-16 rounded-full shadow-lg relative overflow-hidden"
                style={{
                  backgroundImage: "url('/stone-bg.jpg')",
                  backgroundSize: '80px',
                  filter: 'brightness(1.3) contrast(1.1)',
                  border: `3px solid ${confirmColor.border}`,
                }}
              >
                <div className="absolute inset-0 rounded-full" style={
                  confirmColor.gradient ? { background: confirmColor.gradient } : { backgroundColor: confirmColor.tint }
                } />
              </div>
            </div>
            <p className="text-white/60 text-sm mb-1 flex items-center justify-center gap-1">
              Cost: <span className="text-amber-400 font-heading">{confirmColor.price}</span> <JesterCoin size={14} />
            </p>
            {coins !== null && (
              <p className="text-white/30 text-[10px] mb-4">Your balance: {coins} coins</p>
            )}
            {coins !== null && coins < (confirmColor.price || 0) ? (
              <p className="text-red-400 text-xs mb-4">Not enough coins!</p>
            ) : null}
            <div className="flex gap-3 justify-center">
              <button onClick={handlePurchase}
                disabled={coins !== null && coins < (confirmColor.price || 0)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed">
                Unlock
              </button>
              <button onClick={() => setConfirmColor(null)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
