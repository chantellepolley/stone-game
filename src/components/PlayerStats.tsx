import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';
import { getCoinHistory, AI_WAGER } from '../lib/coins';
import JesterCoin from './JesterCoin';
import type { AIDifficulty } from '../types/game';

interface Stats {
  wins: number;
  losses: number;
  games_played: number;
  pieces_captured: number;
  pieces_borne_off: number;
}

interface GameHistoryRow {
  id: string;
  mode: string;
  status: string;
  winner_id: string | null;
  updated_at: string;
  opponent_name: string;
  my_player: 1 | 2;
  result: 'won' | 'lost' | 'in_progress' | 'canceled';
  my_captures: number;
  opp_captures: number;
  my_borne_off: number;
  opp_borne_off: number;
  turns: number;
  my_jesters: number;
  my_doubles: number;
  opp_jesters: number;
  opp_doubles: number;
  wager: number;
}

interface HeadToHead {
  opponent_id: string;
  opponent_name: string;
  wins: number;
  losses: number;
  total: number;
}

export default function PlayerStats({ onBack, onInviteToPlay }: { onBack: () => void; onInviteToPlay?: (playerId: string) => void }) {
  const { player } = usePlayerContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<GameHistoryRow[]>([]);
  const [headToHead, setHeadToHead] = useState<HeadToHead[]>([]);
  const [coinHistory, setCoinHistory] = useState<Array<{ amount: number; reason: string; balance_after: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history' | 'rivals' | 'coins'>('overview');

  useEffect(() => {
    if (!player) return;
    const load = async () => {
      // Fetch stats
      const { data: statsData } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', player.id)
        .single();
      if (statsData) setStats(statsData);

      // Fetch completed games
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, mode, status, winner_id, updated_at, player1_id, player2_id, state, wager')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (gamesData && gamesData.length > 0) {
        // Get opponent names
        const opponentIds = gamesData
          .map(g => g.player1_id === player.id ? g.player2_id : g.player1_id)
          .filter(Boolean) as string[];
        const uniqueIds = [...new Set(opponentIds)];

        const nameMap: Record<string, string> = {};
        if (uniqueIds.length > 0) {
          const { data: players } = await supabase
            .from('players')
            .select('id, username')
            .in('id', uniqueIds);
          players?.forEach(p => { nameMap[p.id] = p.username; });
        }

        // Build history rows
        const rows: GameHistoryRow[] = gamesData.map(g => {
          const myPlayer = g.player1_id === player.id ? 1 : 2;
          const opponentId = myPlayer === 1 ? g.player2_id : g.player1_id;
          const state = g.state as any;
          const isAI = g.mode === 'ai';
          const isLocal = g.mode === 'local';
          const captures = state?.captureCount || { 1: 0, 2: 0 };

          let result: 'won' | 'lost' | 'in_progress' | 'canceled' = 'in_progress';
          if (g.winner_id === player.id) result = 'won';
          else if (g.winner_id) result = 'lost';
          else if (state?.winner === myPlayer) result = 'won';
          else if (state?.winner) result = 'lost';
          else if (g.status === 'completed') result = 'canceled';

          return {
            id: g.id,
            mode: g.mode || 'online',
            status: g.status,
            winner_id: g.winner_id,
            updated_at: g.updated_at,
            opponent_name: isAI ? `Computer (${((g.state as any)?.aiDifficulty || 'medium').charAt(0).toUpperCase() + ((g.state as any)?.aiDifficulty || 'medium').slice(1)})` : isLocal ? 'Local 2P' : (opponentId ? (nameMap[opponentId] || 'Unknown') : 'Unknown'),
            my_player: myPlayer as 1 | 2,
            result,
            my_captures: captures[myPlayer] || 0,
            opp_captures: captures[myPlayer === 1 ? 2 : 1] || 0,
            my_borne_off: state?.home?.[myPlayer]?.length || 0,
            opp_borne_off: state?.home?.[myPlayer === 1 ? 2 : 1]?.length || 0,
            turns: state?.turnCount || 0,
            my_jesters: state?.jesterCount?.[myPlayer] || 0,
            my_doubles: state?.doublesCount?.[myPlayer] || 0,
            opp_jesters: state?.jesterCount?.[myPlayer === 1 ? 2 : 1] || 0,
            opp_doubles: state?.doublesCount?.[myPlayer === 1 ? 2 : 1] || 0,
            wager: isAI ? (AI_WAGER[state?.aiDifficulty as AIDifficulty] || 0) : (g.wager || 0),
          };
        });
        setHistory(rows);

        // Build head-to-head stats (online games only)
        const h2h: Record<string, HeadToHead> = {};
        for (const g of gamesData) {
          if (g.mode !== 'online') continue;
          const myPlayer = g.player1_id === player.id ? 1 : 2;
          const opponentId = (myPlayer === 1 ? g.player2_id : g.player1_id) as string;
          if (!opponentId) continue;

          if (!h2h[opponentId]) {
            h2h[opponentId] = {
              opponent_id: opponentId,
              opponent_name: nameMap[opponentId] || 'Unknown',
              wins: 0, losses: 0, total: 0,
            };
          }
          h2h[opponentId].total++;

          const state = g.state as any;
          if (g.winner_id === player.id || state?.winner === myPlayer) h2h[opponentId].wins++;
          else if (g.winner_id || state?.winner) h2h[opponentId].losses++;
        }
        setHeadToHead(Object.values(h2h).sort((a, b) => b.total - a.total));
      }

      // Load coin history
      const txns = await getCoinHistory(player.id);
      setCoinHistory(txns);

      setLoading(false);
    };
    load();
  }, [player]);

  const winPct = stats && stats.games_played > 0
    ? Math.round((stats.wins / stats.games_played) * 100)
    : 0;

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
    <div className="h-screen flex flex-col items-center justify-center gap-4 px-4">
      <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-3 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full max-h-[75vh] overflow-hidden">
        {player?.avatarUrl && (
          <img src={player.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-[#6b5f55]" />
        )}
        <p className="text-white font-heading text-lg">{player?.username}'s Stats</p>

        {/* Tab bar */}
        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-full">
          {(['overview', 'history', 'rivals', 'coins'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer
                ${tab === t ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
              {t === 'overview' ? 'Overview' : t === 'history' ? 'History' : t === 'rivals' ? 'Rivals' : 'Coins'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : tab === 'overview' ? (
          /* ── Overview tab ── */
          stats ? (
            <div className="grid grid-cols-2 gap-2 w-full text-center">
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-amber-400">{stats.wins}</div>
                <div className="text-[10px] text-white/50 uppercase">Wins</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-sky-400">{stats.losses}</div>
                <div className="text-[10px] text-white/50 uppercase">Losses</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-white">{stats.games_played}</div>
                <div className="text-[10px] text-white/50 uppercase">Games</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-white">{winPct}%</div>
                <div className="text-[10px] text-white/50 uppercase">Win Rate</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-red-400">{stats.pieces_captured}</div>
                <div className="text-[10px] text-white/50 uppercase">Captured</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2.5">
                <div className="text-xl font-heading text-green-400">{stats.pieces_borne_off}</div>
                <div className="text-[10px] text-white/50 uppercase">Borne Off</div>
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-sm">No stats yet. Play a game!</p>
          )
        ) : tab === 'history' ? (
          /* ── Game History tab ── */
          history.length === 0 ? (
            <p className="text-white/40 text-sm">No completed games yet</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-1.5 max-h-[45vh]">
              {history.map(g => (
                <div key={g.id} className={`flex items-center justify-between px-3 py-2 rounded-lg bg-black/20 text-left ${g.result === 'canceled' ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs">
                      vs <span className="font-heading">{g.opponent_name}</span>
                      {g.mode === 'ai' && <span className="text-white/30 text-[9px] ml-1">(AI)</span>}
                    </div>
                    <div className="flex flex-col gap-0.5 text-[9px] text-white/40 mt-0.5">
                      <div className="flex gap-2 items-center">
                        <span className={g.result === 'won' ? 'text-green-400' : g.result === 'canceled' ? 'text-white/30' : 'text-red-400'}>
                          {g.result === 'won' ? 'Won' : g.result === 'canceled' ? 'Canceled' : 'Lost'}
                        </span>
                        {g.wager > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-400/70"><JesterCoin size={10} /> {g.wager}</span>
                        )}
                        <span>{g.turns} turns</span>
                      </div>
                      {g.result !== 'canceled' && (
                        <div className="flex gap-3">
                          <span>You: {g.my_captures} cap, {g.my_borne_off} home, {g.my_jesters} jst, {g.my_doubles} dbl</span>
                        </div>
                      )}
                      {g.result !== 'canceled' && (
                        <div className="flex gap-3">
                          <span>Opp: {g.opp_captures} cap, {g.opp_borne_off} home, {g.opp_jesters} jst, {g.opp_doubles} dbl</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-white/30 text-[9px] shrink-0 ml-2">{timeAgo(g.updated_at)}</div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'rivals' ? (
          /* ── Rivals tab (head-to-head) ── */
          headToHead.length === 0 ? (
            <p className="text-white/40 text-sm">No online opponents yet</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-1.5 max-h-[45vh]">
              {headToHead.map(h => {
                const pct = h.total > 0 ? Math.round((h.wins / h.total) * 100) : 0;
                return (
                  <div key={h.opponent_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
                    <div>
                      <div className="text-white text-sm font-heading">{h.opponent_name}</div>
                      <div className="text-[9px] text-white/40">{h.total} games played</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-sm font-heading text-green-400">{h.wins}</div>
                        <div className="text-[8px] text-white/40">W</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-heading text-red-400">{h.losses}</div>
                        <div className="text-[8px] text-white/40">L</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-heading text-white">{pct}%</div>
                        <div className="text-[8px] text-white/40">Win</div>
                      </div>
                      {onInviteToPlay && (
                        <button
                          onClick={() => onInviteToPlay(h.opponent_id)}
                          className="px-2 py-1 rounded text-[8px] font-heading uppercase tracking-wider
                                     bg-amber-600/60 text-white hover:bg-amber-600 cursor-pointer transition-colors ml-1"
                        >
                          Invite
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── Coins tab ── */
          coinHistory.length === 0 ? (
            <p className="text-white/40 text-sm">No coin transactions yet</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-1 max-h-[45vh]">
              {coinHistory.map((tx, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs">{tx.reason}</div>
                    <div className="text-[9px] text-white/30">{new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-sm font-heading ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <JesterCoin size={14} />
                    <span className="text-[9px] text-white/30">{tx.balance_after}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-1">
          Back
        </button>
      </div>
    </div>
  );
}
