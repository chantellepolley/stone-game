import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';

interface Stats {
  wins: number;
  losses: number;
  games_played: number;
  pieces_captured: number;
  pieces_borne_off: number;
}

export default function PlayerStats({ onBack }: { onBack: () => void }) {
  const { player } = usePlayerContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player) return;
    const load = async () => {
      const { data } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', player.id)
        .single();
      if (data) setStats(data);
      setLoading(false);
    };
    load();
  }, [player]);

  const winPct = stats && stats.games_played > 0
    ? Math.round((stats.wins / stats.games_played) * 100)
    : 0;

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
        <p className="text-white font-heading text-lg">{player?.username}'s Stats</p>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3 w-full text-center">
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-amber-400">{stats.wins}</div>
              <div className="text-[10px] text-white/50 uppercase">Wins</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-sky-400">{stats.losses}</div>
              <div className="text-[10px] text-white/50 uppercase">Losses</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-white">{stats.games_played}</div>
              <div className="text-[10px] text-white/50 uppercase">Games</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-white">{winPct}%</div>
              <div className="text-[10px] text-white/50 uppercase">Win Rate</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-red-400">{stats.pieces_captured}</div>
              <div className="text-[10px] text-white/50 uppercase">Captured</div>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <div className="text-2xl font-heading text-green-400">{stats.pieces_borne_off}</div>
              <div className="text-[10px] text-white/50 uppercase">Borne Off</div>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm">No stats yet. Play a game!</p>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2">
          Back
        </button>
      </div>
    </div>
  );
}
