import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';

interface GameRow {
  id: string;
  room_code: string;
  player1_id: string;
  player2_id: string | null;
  status: string;
  mode: string;
  updated_at: string;
  my_player: 1 | 2;
  opponent_name: string;
  is_my_turn: boolean;
  winner_label: string | null;
}

interface MyGamesProps {
  onResume: (gameId: string, roomCode: string, player: 1 | 2, mode: string) => void;
  onBack: () => void;
}

export default function MyGames({ onResume, onBack }: MyGamesProps) {
  const { player } = usePlayerContext();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player) return;
    const load = async () => {
      // Fetch games where this player is p1 or p2 (active + recent completed)
      const { data } = await supabase
        .from('games')
        .select('id, room_code, player1_id, player2_id, status, state, updated_at, mode, winner_id')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .in('status', ['active', 'waiting', 'completed'])
        .order('updated_at', { ascending: false })
        .limit(30);

      if (!data) { setLoading(false); return; }

      // Get opponent names
      const opponentIds = data
        .filter(g => g.mode === 'online')
        .map(g => g.player1_id === player.id ? g.player2_id : g.player1_id)
        .filter(Boolean);

      const nameMap: Record<string, string> = {};
      if (opponentIds.length > 0) {
        const { data: players } = await supabase
          .from('players')
          .select('id, username')
          .in('id', opponentIds);
        players?.forEach(p => { nameMap[p.id] = p.username; });
      }

      const rows: GameRow[] = data.map(g => {
        const myPlayer = g.player1_id === player.id ? 1 : 2;
        const opponentId = myPlayer === 1 ? g.player2_id : g.player1_id;
        const currentPlayer = (g.state as any)?.currentPlayer || 1;
        const mode = g.mode || 'online';
        const isAI = mode === 'ai';
        const isLocal = mode === 'local';

        let winnerLabel: string | null = null;
        if (g.status === 'completed') {
          if (g.winner_id === player.id) winnerLabel = 'You won';
          else if (g.winner_id) winnerLabel = 'You lost';
          else {
            const stateWinner = (g.state as any)?.winner;
            if (stateWinner === myPlayer) winnerLabel = 'You won';
            else if (stateWinner) winnerLabel = 'You lost';
          }
        }

        return {
          id: g.id,
          room_code: g.room_code,
          player1_id: g.player1_id,
          player2_id: g.player2_id,
          status: g.status,
          mode,
          updated_at: g.updated_at,
          my_player: myPlayer as 1 | 2,
          opponent_name: isAI ? 'Computer' : isLocal ? 'Local 2P' : (opponentId ? (nameMap[opponentId] || 'Unknown') : 'Waiting...'),
          is_my_turn: g.status !== 'completed' && currentPlayer === myPlayer,
          winner_label: winnerLabel,
        };
      });

      setGames(rows);
      setLoading(false);
    };
    load();
  }, [player]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full max-h-[60vh]">
        <p className="text-white font-heading text-lg">My Games</p>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : games.length === 0 ? (
          <p className="text-white/40 text-sm">No active games</p>
        ) : (
          <div className="w-full overflow-y-auto space-y-2">
            {games.map(g => {
              const isCompleted = g.status === 'completed';
              const canResume = !isCompleted;
              return (
                <button
                  key={g.id}
                  onClick={() => canResume ? onResume(g.id, g.room_code, g.my_player, g.mode) : undefined}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg
                             bg-black/20 text-left transition-colors
                             ${!canResume ? 'opacity-70 cursor-default' : 'hover:bg-black/30 cursor-pointer'}`}
                >
                  <div>
                    <div className="text-white text-sm">
                      vs <span className="font-heading">{g.opponent_name}</span>
                      {g.mode === 'ai' && <span className="text-white/30 text-[10px] ml-1">(AI)</span>}
                      {g.mode === 'local' && <span className="text-white/30 text-[10px] ml-1">(Local)</span>}
                    </div>
                    <div className="text-white/40 text-[10px]">
                      {isCompleted ? (
                        <span className={g.winner_label === 'You won' ? 'text-green-400' : 'text-red-400'}>
                          {g.winner_label || 'Completed'}
                        </span>
                      ) : g.is_my_turn ? (
                        <span className="text-amber-400">Your turn</span>
                      ) : (
                        <span>Opponent's turn</span>
                      )}
                      {' · '}{timeAgo(g.updated_at)}
                    </div>
                  </div>
                  <div className="text-white/30 text-xs font-heading">
                    {g.mode === 'online' ? g.room_code : g.mode === 'ai' ? 'AI' : '2P'}
                  </div>
                </button>
              );
            })}
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
