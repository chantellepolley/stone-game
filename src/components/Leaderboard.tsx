import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useFriends } from '../hooks/useFriends';

interface LeaderEntry {
  player_id: string;
  wins: number;
  losses: number;
  games_played: number;
  username?: string;
  avatar_url?: string | null;
}

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const { player } = usePlayerContext();
  const { addFriendById } = useFriends();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendAdded, setFriendAdded] = useState<Set<string>>(new Set());
  const [friendStatusMap, setFriendStatusMap] = useState<Map<string, string>>(new Map());

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
        .select('id, username, avatar_url')
        .in('id', ids);

      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {};
      players?.forEach(p => { nameMap[p.id] = p.username; avatarMap[p.id] = p.avatar_url; });

      setEntries(stats.map(s => ({ ...s, username: nameMap[s.player_id] || 'Unknown', avatar_url: avatarMap[s.player_id] || null })));

      // Check which players are already friends (with status)
      if (player) {
        const { data: friendships } = await supabase
          .from('friends')
          .select('player_id, friend_id, status')
          .or(`player_id.eq.${player.id},friend_id.eq.${player.id}`);
        const statusMap = new Map<string, string>();
        friendships?.forEach(f => {
          const otherId = f.player_id === player.id ? f.friend_id : f.player_id;
          statusMap.set(otherId, f.status);
        });
        setFriendStatusMap(statusMap);
      }

      setLoading(false);
    };
    load();
  }, [player]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

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
                  <th className="py-1 px-1"></th>
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
                      <td className="py-1.5 px-1 truncate max-w-[150px]">
                        <div className="flex items-center gap-1.5">
                          {e.avatar_url ? (
                            <img src={e.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[#3d3632] flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-heading text-white/40">{(e.username || '?')[0].toUpperCase()}</span>
                            </div>
                          )}
                          <span className="truncate">{e.username}{isMe ? ' (you)' : ''}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-1 text-center">{e.wins}</td>
                      <td className="py-1.5 px-1 text-center">{e.losses}</td>
                      <td className="py-1.5 px-1 text-center">{pct}%</td>
                      <td className="py-1.5 px-1">
                        {isMe ? null : friendStatusMap.get(e.player_id) === 'accepted' ? (
                          <span className="text-[8px] text-green-400/70 flex items-center gap-0.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                            Friend
                          </span>
                        ) : friendStatusMap.get(e.player_id) === 'pending' || friendAdded.has(e.player_id) ? (
                          <span className="text-[8px] text-amber-400/70 whitespace-nowrap">Pending</span>
                        ) : (
                          <button
                            onClick={async () => {
                              const r = await addFriendById(e.player_id);
                              if (r === true) {
                                setFriendAdded(prev => new Set(prev).add(e.player_id));
                              } else if (r === 'Already friends') {
                                setFriendStatusMap(prev => new Map(prev).set(e.player_id, 'accepted'));
                              } else if (r === 'Friend invite already sent') {
                                setFriendAdded(prev => new Set(prev).add(e.player_id));
                              }
                            }}
                            className="px-2 py-0.5 rounded text-[8px] font-heading uppercase tracking-wider whitespace-nowrap
                                       bg-amber-600/70 text-white hover:bg-amber-600 cursor-pointer transition-colors"
                          >
                            + Add Friend
                          </button>
                        )}
                      </td>
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
