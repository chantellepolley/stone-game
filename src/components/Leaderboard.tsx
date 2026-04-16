import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';

interface LeaderEntry {
  player_id: string;
  wins: number;
  losses: number;
  games_played: number;
  username?: string;
}

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const { player } = usePlayerContext();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fetch top 20 by wins
      const { data: stats } = await supabase
        .from('player_stats')
        .select('player_id, wins, losses, games_played')
        .gt('games_played', 0)
        .order('wins', { ascending: false })
        .limit(20);

      if (!stats || stats.length === 0) { setLoading(false); return; }

      // Fetch usernames
      const ids = stats.map(s => s.player_id);
      const { data: players } = await supabase
        .from('players')
        .select('id, username')
        .in('id', ids);

      const nameMap: Record<string, string> = {};
      players?.forEach(p => { nameMap[p.id] = p.username; });

      setEntries(stats.map(s => ({ ...s, username: nameMap[s.player_id] || 'Unknown' })));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full max-h-[60vh]">
        <p className="text-white font-heading text-lg">Leaderboard</p>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-white/40 text-sm">No games played yet!</p>
        ) : (
          <div className="w-full overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 text-[10px] uppercase border-b border-white/10">
                  <th className="text-left py-1 px-1">#</th>
                  <th className="text-left py-1 px-1">Player</th>
                  <th className="text-center py-1 px-1">W</th>
                  <th className="text-center py-1 px-1">L</th>
                  <th className="text-center py-1 px-1">%</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const isMe = e.player_id === player?.id;
                  const pct = e.games_played > 0 ? Math.round((e.wins / e.games_played) * 100) : 0;
                  return (
                    <tr key={e.player_id}
                      className={`border-b border-white/5 ${isMe ? 'text-amber-400' : 'text-white/80'}`}>
                      <td className="py-1.5 px-1 font-heading">{i + 1}</td>
                      <td className="py-1.5 px-1 truncate max-w-[120px]">{e.username}{isMe ? ' (you)' : ''}</td>
                      <td className="py-1.5 px-1 text-center">{e.wins}</td>
                      <td className="py-1.5 px-1 text-center">{e.losses}</td>
                      <td className="py-1.5 px-1 text-center">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
