import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CHAMPION_STONES } from '../utils/stoneColors';

interface Champion {
  month: string;
  player_id: string;
  points: number;
  stone_id: string;
  username: string;
  avatar_url: string | null;
  runners: { username: string; points: number }[];
}

export default function HallOfFame({ onBack }: { onBack: () => void }) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('champions')
        .select('month, player_id, points, stone_id')
        .order('month', { ascending: false });

      if (!data || data.length === 0) { setLoading(false); return; }

      const ids = data.map(c => c.player_id);
      const { data: players } = await supabase
        .from('players')
        .select('id, username, avatar_url')
        .in('id', ids);

      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {};
      players?.forEach(p => { nameMap[p.id] = p.username; avatarMap[p.id] = p.avatar_url; });

      // Fetch 2nd and 3rd place for each month
      const championsWithRunners = await Promise.all(data.map(async (c) => {
        const { data: standings } = await supabase
          .from('monthly_points')
          .select('player_id, points')
          .eq('month', c.month)
          .eq('qualified', true)
          .order('points', { ascending: false })
          .limit(3);

        const runners: { username: string; points: number }[] = [];
        if (standings && standings.length > 1) {
          const runnerIds = standings.slice(1).map(s => s.player_id);
          const { data: runnerPlayers } = await supabase
            .from('players')
            .select('id, username')
            .in('id', runnerIds);
          const runnerNameMap: Record<string, string> = {};
          runnerPlayers?.forEach(p => { runnerNameMap[p.id] = p.username; });
          for (let i = 1; i < standings.length; i++) {
            runners.push({ username: runnerNameMap[standings[i].player_id] || 'Unknown', points: standings[i].points });
          }
        }

        return {
          ...c,
          username: nameMap[c.player_id] || 'Unknown',
          avatar_url: avatarMap[c.player_id] || null,
          runners,
        };
      }));

      setChampions(championsWithRunners);
      setLoading(false);
    };
    load();
  }, []);

  const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-4">
      <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer shrink-0" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full overflow-y-auto max-h-[75vh]">
        <div className="text-center">
          <p className="text-amber-400 font-heading text-lg">Hall of Fame</p>
          <p className="text-white/50 text-xs">Player of the Month Champions</p>
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : champions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/40 text-sm mb-2">No champions yet</p>
            <p className="text-white/30 text-xs">The first Player of the Month will be crowned at the end of May 2026!</p>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {champions.map(c => {
              const stone = CHAMPION_STONES.find(s => s.id === c.stone_id);
              return (
                <div key={c.month} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-900/30 to-transparent border border-amber-600/30">
                  {/* Champion stone preview */}
                  {stone?.image ? (
                    <img src={stone.image} alt={stone.name} className="w-14 h-14 object-contain shrink-0" />
                  ) : (
                    <div
                      className="w-12 h-12 shrink-0 relative overflow-hidden"
                      style={{
                        backgroundImage: "url('/stone-bg.jpg')",
                        backgroundSize: '60px',
                        filter: 'brightness(1.3) contrast(1.1)',
                        clipPath: 'polygon(50% 0%, 65% 25%, 100% 15%, 75% 40%, 100% 50%, 75% 60%, 100% 85%, 65% 75%, 50% 100%, 35% 75%, 0% 85%, 25% 60%, 0% 50%, 25% 40%, 0% 15%, 35% 25%)',
                        boxShadow: '0 0 12px rgba(255,200,0,0.4)',
                      }}>
                      <div className="absolute inset-0" style={
                        stone?.gradient ? { background: stone.gradient } : { backgroundColor: stone?.tint || 'rgba(255,215,0,0.3)' }
                      } />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-amber-400 font-heading text-xs uppercase tracking-wider">{formatMonth(c.month)}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-amber-600/40" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#3d3632] flex items-center justify-center border border-amber-600/40">
                          <span className="text-[8px] font-heading text-white/50">{c.username[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <span className="text-white font-heading text-sm truncate">{c.username}</span>
                    </div>
                    <div className="text-[9px] text-white/30 mt-0.5">{c.points} points | {stone?.name || 'Champion Stone'}</div>
                    {c.runners.length > 0 && (
                      <div className="flex gap-3 mt-1 text-[9px] text-white/25">
                        {c.runners.map((r, i) => (
                          <span key={i}>{i === 0 ? '2nd' : '3rd'}: {r.username} ({r.points})</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2 shrink-0">
          Back
        </button>
      </div>
    </div>
  );
}
