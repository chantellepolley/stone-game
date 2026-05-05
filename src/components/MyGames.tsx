import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';
import { AI_WAGER } from '../lib/coins';
import type { AIDifficulty } from '../types/game';
import { useFriends } from '../hooks/useFriends';
import JesterCoin from './JesterCoin';

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
  wager: number;
}

interface InviteRow {
  id: string;
  from_player_id: string;
  game_id: string;
  room_code: string;
  from_username: string;
  created_at: string;
}

interface SentInviteRow {
  id: string;
  to_player_id: string;
  game_id: string;
  room_code: string;
  to_username: string;
  status: string;
  created_at: string;
  wager: number;
}

interface MyGamesProps {
  onResume: (gameId: string, roomCode: string, player: 1 | 2, mode: string) => void;
  onBack: () => void;
}

export default function MyGames({ onResume, onBack }: MyGamesProps) {
  const { player } = usePlayerContext();
  const { getPendingRequests, pendingRequests, acceptFriend } = useFriends();
  const [games, setGames] = useState<GameRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sentInvites, setSentInvites] = useState<SentInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'invites' | 'past'>('active');

  useEffect(() => {
    if (!player) return;
    const load = async () => {
      // Fetch games where this player is p1 or p2 (active + recent completed)
      // Fetch active and completed games separately — active needs state, completed doesn't
      const [{ data: activeData }, { data: completedData }] = await Promise.all([
        supabase
          .from('games')
          .select('id, room_code, player1_id, player2_id, status, state, updated_at, mode, winner_id, wager')
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('games')
          .select('id, room_code, player1_id, player2_id, status, state, updated_at, mode, winner_id, wager')
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(30),
      ]);
      const data = [...(activeData || []), ...(completedData || [])];

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
        const currentPlayer = (g as any).state?.currentPlayer || 1;
        const mode = g.mode || 'online';
        const isAI = mode === 'ai';
        const isLocal = mode === 'local';

        let winnerLabel: string | null = null;
        if (g.status === 'completed') {
          if (g.winner_id === player.id) winnerLabel = 'You won';
          else if (g.winner_id) winnerLabel = 'You lost';
          else {
            // No winner_id — check if game ended naturally or was manually ended
            const statePhase = (g as any).state?.phase;
            const stateWinner = (g as any).state?.winner;
            if (statePhase === 'game_over' && stateWinner === myPlayer) winnerLabel = 'You won';
            else if (statePhase === 'game_over' && stateWinner) winnerLabel = 'You lost';
            else winnerLabel = 'Ended';
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
          opponent_name: isAI ? `Computer (${(((g as any).state?.aiDifficulty) || 'medium').charAt(0).toUpperCase() + (((g as any).state?.aiDifficulty) || 'medium').slice(1)})` : isLocal ? 'Local 2P' : (opponentId ? (nameMap[opponentId] || 'Unknown') : 'Waiting...'),
          is_my_turn: g.status !== 'completed' && currentPlayer === myPlayer,
          winner_label: winnerLabel,
          wager: isAI ? (AI_WAGER[((g as any).state?.aiDifficulty) as AIDifficulty] || 0) : (g.wager || 0),
        };
      });

      setGames(rows);

      // Fetch pending game invites
      const { data: inviteData } = await supabase
        .from('game_invites')
        .select('id, from_player_id, game_id, room_code, created_at')
        .eq('to_player_id', player.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inviteData && inviteData.length > 0) {
        const fromIds = inviteData.map(i => i.from_player_id);
        const { data: fromPlayers } = await supabase
          .from('players')
          .select('id, username')
          .in('id', fromIds);

        const fromMap: Record<string, string> = {};
        fromPlayers?.forEach(p => { fromMap[p.id] = p.username; });

        setInvites(inviteData.map(i => ({
          id: i.id,
          from_player_id: i.from_player_id,
          game_id: i.game_id,
          room_code: i.room_code,
          from_username: fromMap[i.from_player_id] || 'Unknown',
          created_at: i.created_at,
        })));
      }

      // Fetch sent invites
      const { data: sentData } = await supabase
        .from('game_invites')
        .select('id, to_player_id, game_id, room_code, status, created_at')
        .eq('from_player_id', player.id)
        .in('status', ['pending'])
        .order('created_at', { ascending: false });

      if (sentData && sentData.length > 0) {
        const toIds = sentData.map(i => i.to_player_id);
        const gameIds = sentData.map(i => i.game_id);
        const [{ data: toPlayers }, { data: gameRows }] = await Promise.all([
          supabase.from('players').select('id, username').in('id', toIds),
          supabase.from('games').select('id, wager').in('id', gameIds),
        ]);

        const toMap: Record<string, string> = {};
        toPlayers?.forEach(p => { toMap[p.id] = p.username; });
        const wagerMap: Record<string, number> = {};
        gameRows?.forEach(g => { wagerMap[g.id] = g.wager || 0; });

        setSentInvites(sentData.map(i => ({
          id: i.id,
          to_player_id: i.to_player_id,
          game_id: i.game_id,
          room_code: i.room_code,
          to_username: toMap[i.to_player_id] || 'Unknown',
          status: i.status,
          created_at: i.created_at,
          wager: wagerMap[i.game_id] || 0,
        })));
      }

      // Load friend requests
      await getPendingRequests();

      setLoading(false);

      // Auto-switch to invites tab if there are pending invites/friend requests
      if ((inviteData && inviteData.length > 0)) {
        setTab('invites');
      }
    };
    load();
  }, [player, getPendingRequests]);

  const handleAcceptInvite = async (invite: InviteRow) => {
    // Update invite status
    await supabase
      .from('game_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    // Join the game as player 2
    onResume(invite.game_id, invite.room_code, 2, 'online');
  };

  const [confirmEndGameId, setConfirmEndGameId] = useState<string | null>(null);

  const handleEndGame = async (gameId: string) => {
    // End game — no winner, shows as "Ended" not a loss
    await supabase.from('games').update({ status: 'completed', winner_id: null, updated_at: new Date().toISOString() }).eq('id', gameId);
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: 'completed', winner_label: 'Ended' } : g));
    setConfirmEndGameId(null);
  };

  const handleCancelGame = async (gameId: string) => {
    // Cancel game — delete invites first (foreign key), then the game
    await supabase.from('game_invites').delete().eq('game_id', gameId);
    const { error } = await supabase.from('games').delete().eq('id', gameId);
    if (error) {
      // If delete fails, mark as completed instead
      await supabase.from('games').update({ status: 'completed', winner_id: null, updated_at: new Date().toISOString() }).eq('id', gameId);
    }
    setGames(prev => prev.filter(g => g.id !== gameId));
    // Clear from localStorage if this was the active game
    try {
      const saved = localStorage.getItem('stone_active_game');
      if (saved && JSON.parse(saved).gameId === gameId) localStorage.removeItem('stone_active_game');
    } catch {}
  };

  const handleRemoveGame = async (gameId: string) => {
    await supabase.from('game_invites').delete().eq('game_id', gameId);
    const { error } = await supabase.from('games').delete().eq('id', gameId);
    if (error) {
      await supabase.from('games').update({ status: 'completed', winner_id: null }).eq('id', gameId);
    }
    setGames(prev => prev.filter(g => g.id !== gameId));
  };

  const handleDeclineInvite = async (inviteId: string) => {
    await supabase
      .from('game_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Filter out waiting games with no opponent (abandoned rooms)
  const activeGames = games.filter(g => g.status !== 'completed' && g.opponent_name !== 'Waiting...');
  const pastGames = games.filter(g => g.status === 'completed');
  const incomingInviteCount = invites.length;  // only incoming game invites trigger badge
  const myTurnCount = activeGames.filter(g => g.is_my_turn).length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full max-h-[60vh]">
        <p className="text-white font-heading text-lg">My Games</p>

        {/* Tab bar */}
        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-full">
          <button onClick={() => setTab('invites')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer relative
              ${tab === 'invites' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
            Invites
            {incomingInviteCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {incomingInviteCount}
              </span>
            )}
          </button>
          <button onClick={() => setTab('active')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer relative
              ${tab === 'active' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
            Active
            {myTurnCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {myTurnCount}
              </span>
            )}
          </button>
          <button onClick={() => setTab('past')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer
              ${tab === 'past' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
            Past
          </button>
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : tab === 'invites' ? (
          /* Invites tab — game invites + friend requests */
          invites.length === 0 && pendingRequests.length === 0 && sentInvites.length === 0 ? (
            <p className="text-white/40 text-sm">No pending invites</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-2 max-h-[45vh]">
              {/* Game invites */}
              {invites.length > 0 && (
                <div className="text-[9px] text-amber-400/60 uppercase tracking-wider px-1">Game Invites</div>
              )}
              {invites.map(inv => (
                <div key={inv.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <div className="text-white text-sm">
                        Game invite from <span className="font-heading text-amber-400">{inv.from_username}</span>
                      </div>
                      <div className="text-white/40 text-[10px]">
                        {timeAgo(inv.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAcceptInvite(inv)}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-heading uppercase tracking-wider
                                 bg-green-600/60 text-white hover:bg-green-600 cursor-pointer transition-colors"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(inv.id)}
                      className="px-3 py-1.5 rounded-lg text-[9px] font-heading uppercase tracking-wider
                                 bg-black/30 text-white/60 hover:text-white cursor-pointer transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}

              {/* Friend requests */}
              {pendingRequests.length > 0 && (
                <div className="text-[9px] text-green-400/60 uppercase tracking-wider px-1 pt-1">Friend Requests</div>
              )}
              {pendingRequests.map(r => (
                <div key={r.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#3d3632] flex items-center justify-center">
                        <span className="text-[9px] text-white/40 font-heading">{r.username[0].toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      <div className="text-white text-sm">
                        <span className="font-heading">{r.username}</span> wants to be friends
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => { await acceptFriend(r.id); await getPendingRequests(); }}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-heading uppercase tracking-wider
                               bg-green-600/60 text-white hover:bg-green-600 cursor-pointer transition-colors"
                  >
                    Accept
                  </button>
                </div>
              ))}

              {/* Sent invites */}
              {sentInvites.length > 0 && (
                <div className="text-[9px] text-white/40 uppercase tracking-wider px-1 pt-2">Sent Invites</div>
              )}
              {sentInvites.map(si => (
                <div key={si.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/30 shrink-0" />
                    <div>
                      <div className="text-white text-sm">
                        Invited <span className="font-heading text-amber-400">{si.to_username}</span>
                      </div>
                      <div className="text-white/40 text-[10px]">
                        <span className="text-amber-400/70">Pending</span>
                        {si.wager > 0 && <span className="text-amber-400/70 ml-1 inline-flex items-center gap-0.5"><JesterCoin size={10} /> {si.wager}</span>}
                        {' · '}{timeAgo(si.created_at)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from('game_invites').update({ status: 'declined' }).eq('id', si.id);
                      setSentInvites(prev => prev.filter(i => i.id !== si.id));
                    }}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-heading uppercase tracking-wider
                               bg-black/30 text-white/60 hover:text-white cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )
        ) : tab === 'active' ? (
          /* Active Games tab */
          activeGames.length === 0 ? (
            <p className="text-white/40 text-sm">No active games</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-2">
              {activeGames.map(g => (
                <button
                  key={g.id}
                  onClick={() => onResume(g.id, g.room_code, g.my_player, g.mode)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg
                             text-left transition-colors hover:bg-black/30 cursor-pointer
                             ${g.is_my_turn ? 'bg-amber-900/20 border border-amber-600/30' : 'bg-black/20'}`}
                >
                  <div className="flex items-center gap-2">
                    {g.is_my_turn && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                    <div>
                      <div className="text-white text-sm">
                        vs <span className="font-heading">{g.opponent_name}</span>
                        {g.mode === 'ai' && <span className="text-white/30 text-[10px] ml-1">(AI)</span>}
                        {g.mode === 'local' && <span className="text-white/30 text-[10px] ml-1">(Local)</span>}
                        {g.wager > 0 && <span className="text-amber-400/70 text-[10px] ml-1 inline-flex items-center gap-0.5"><JesterCoin size={10} /> {g.wager}</span>}
                      </div>
                      <div className="text-white/40 text-[10px]">
                        {g.is_my_turn ? (
                          <span className="text-amber-400 font-bold">Your turn!</span>
                        ) : (
                          <span>Opponent's turn</span>
                        )}
                        {' · '}{timeAgo(g.updated_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30 text-[10px] font-heading">
                      {g.mode === 'online' ? g.room_code : g.mode === 'ai' ? 'AI' : '2P'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmEndGameId(g.id); }}
                      className="px-1.5 py-0.5 rounded text-[7px] font-heading uppercase
                                 bg-white/10 text-white/50 hover:text-white hover:bg-white/20 cursor-pointer transition-colors"
                      title="End game (no winner)"
                    >
                      End
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelGame(g.id); }}
                      className="px-1.5 py-0.5 rounded text-[7px] font-heading uppercase
                                 bg-red-900/30 text-red-400/60 hover:text-red-400 hover:bg-red-900/50 cursor-pointer transition-colors"
                      title="Cancel and remove game"
                    >
                      Cancel
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          /* Past Games tab */
          pastGames.length === 0 ? (
            <p className="text-white/40 text-sm">No completed games</p>
          ) : (
            <div className="w-full overflow-y-auto space-y-2">
              {pastGames.map(g => (
                <div key={g.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-black/20 opacity-70"
                >
                  <div>
                    <div className="text-white text-sm">
                      vs <span className="font-heading">{g.opponent_name}</span>
                      {g.mode === 'ai' && <span className="text-white/30 text-[10px] ml-1">(AI)</span>}
                      {g.mode === 'local' && <span className="text-white/30 text-[10px] ml-1">(Local)</span>}
                      {g.wager > 0 && <span className="text-amber-400/70 text-[10px] ml-1 inline-flex items-center gap-0.5"><JesterCoin size={10} /> {g.wager}</span>}
                    </div>
                    <div className="text-white/40 text-[10px]">
                      <span className={
                        g.winner_label === 'You won' ? 'text-green-400'
                        : g.winner_label === 'You lost' ? 'text-red-400'
                        : 'text-white/50'
                      }>
                        {g.winner_label || 'Completed'}
                      </span>
                      {' · '}{timeAgo(g.updated_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs font-heading">
                      {g.mode === 'online' ? g.room_code : g.mode === 'ai' ? 'AI' : '2P'}
                    </span>
                    <button
                      onClick={() => handleRemoveGame(g.id)}
                      className="text-[8px] text-red-400/60 hover:text-red-400 cursor-pointer transition-colors"
                      title="Remove game"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2">
          Back
        </button>
      </div>

      {/* End game confirmation */}
      {confirmEndGameId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-2">End Game?</h2>
            <p className="text-white/60 text-sm mb-4">This will end the game with no winner. This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleEndGame(confirmEndGameId)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-red-600 text-white hover:bg-red-500 cursor-pointer transition-colors">
                End Game
              </button>
              <button onClick={() => setConfirmEndGameId(null)}
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
