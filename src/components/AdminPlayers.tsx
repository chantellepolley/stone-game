import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PlayerRow {
  id: string;
  username: string;
  created_at: string;
  avatar_url: string | null;
  referred_by: string | null;
  wins: number;
  losses: number;
  games_played: number;
  coins: number;
  login_streak: number;
  last_daily_bonus: string | null;
}

export default function AdminPlayers({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: playersData } = await supabase
        .from('players')
        .select('id, username, created_at, avatar_url, referred_by')
        .order('created_at', { ascending: false });

      if (!playersData) { setLoading(false); return; }

      const ids = playersData.map(p => p.id);
      const { data: statsData } = await supabase
        .from('player_stats')
        .select('player_id, wins, losses, games_played, coins, login_streak, last_daily_bonus')
        .in('player_id', ids);

      const statsMap: Record<string, any> = {};
      statsData?.forEach(s => { statsMap[s.player_id] = s; });

      // Get referrer names
      const referrerIds = playersData.filter(p => p.referred_by).map(p => p.referred_by!);
      const referrerMap: Record<string, string> = {};
      if (referrerIds.length > 0) {
        const { data: referrers } = await supabase
          .from('players')
          .select('id, username')
          .in('id', referrerIds);
        referrers?.forEach(r => { referrerMap[r.id] = r.username; });
      }

      setPlayers(playersData.map(p => {
        const s = statsMap[p.id] || {};
        return {
          id: p.id,
          username: p.username,
          created_at: p.created_at,
          avatar_url: p.avatar_url,
          referred_by: p.referred_by ? (referrerMap[p.referred_by] || p.referred_by.slice(0, 8)) : null,
          wins: s.wins || 0,
          losses: s.losses || 0,
          games_played: s.games_played || 0,
          coins: s.coins ?? 100,
          login_streak: s.login_streak || 0,
          last_daily_bonus: s.last_daily_bonus || null,
        };
      }));
      setLoading(false);
    };
    load();
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  const daysAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-lg w-full max-h-[70vh]">
        <p className="text-white font-heading text-lg">All Players ({players.length})</p>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : (
          <div className="w-full overflow-y-auto space-y-1.5">
            {players.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-[#6b5f55] shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55] shrink-0">
                      <span className="text-xs font-heading text-white/40">{p.username[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white text-sm font-heading truncate">{p.username}</div>
                    <div className="text-[9px] text-white/40">
                      Joined {formatDate(p.created_at)}
                      {p.referred_by && <span className="text-amber-400/60 ml-1">via {p.referred_by}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                  <div className="text-[10px] text-white/60">
                    <span className="text-green-400">{p.wins}W</span>
                    {' '}
                    <span className="text-red-400">{p.losses}L</span>
                    {' '}
                    <span className="text-amber-400">{p.coins}c</span>
                  </div>
                  <div className="text-[8px] text-white/30">
                    Last active: {daysAgo(p.last_daily_bonus)}
                    {p.login_streak > 1 && <span className="text-amber-400/50 ml-1">{p.login_streak}d streak</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2">
          Back
        </button>
      </div>
    </div>
  );
}
