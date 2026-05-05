import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';
import { showNotification } from '../hooks/usePushNotifications';

interface GameInvite {
  id: string;
  fromUsername: string;
  roomCode: string;
  gameId: string;
  createdAt: string;
  wager: number;
}

interface GameResult {
  id: string;
  opponentName: string;
  didWin: boolean;
  wager: number;
}

interface NotificationsProps {
  onAcceptInvite?: (gameId: string, roomCode: string, inviteId?: string) => void;
}

export default function Notifications({ onAcceptInvite }: NotificationsProps) {
  const { player } = usePlayerContext();
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [friendRequests, setFriendRequests] = useState<number>(0);
  const prevInviteCount = useRef(0);
  const prevFriendCount = useRef(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!player) return;

    // Check for pending game invites
    const { data: inviteData } = await supabase
      .from('game_invites')
      .select('id, from_player_id, game_id, room_code, created_at')
      .eq('to_player_id', player.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (inviteData && inviteData.length > 0) {
      const fromIds = inviteData.map(i => i.from_player_id);
      const gameIds = inviteData.map(i => i.game_id);
      const [{ data: players }, { data: gamesData }] = await Promise.all([
        supabase.from('players').select('id, username').in('id', fromIds),
        supabase.from('games').select('id, wager').in('id', gameIds),
      ]);

      const nameMap: Record<string, string> = {};
      players?.forEach(p => { nameMap[p.id] = p.username; });
      const wagerMap: Record<string, number> = {};
      gamesData?.forEach(g => { wagerMap[g.id] = g.wager || 0; });

      setInvites(inviteData.map(i => ({
        id: i.id,
        fromUsername: nameMap[i.from_player_id] || 'Someone',
        roomCode: i.room_code,
        gameId: i.game_id,
        createdAt: i.created_at,
        wager: wagerMap[i.game_id] || 0,
      })));
    } else {
      setInvites([]);
    }

    // Check for pending friend requests
    const { count } = await supabase
      .from('friends')
      .select('id', { count: 'exact', head: true })
      .eq('friend_id', player.id)
      .eq('status', 'pending');

    const newFriendCount = count || 0;
    setFriendRequests(newFriendCount);

    // Check for recently completed games the player hasn't seen
    const seenResults: string[] = JSON.parse(localStorage.getItem('stone_seen_results') || '[]');
    const { data: recentCompleted } = await supabase
      .from('games')
      .select('id, player1_id, player2_id, winner_id, wager, mode, updated_at')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .eq('status', 'completed')
      .eq('mode', 'online')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (recentCompleted) {
      const unseen = recentCompleted.filter(g => !seenResults.includes(g.id));
      if (unseen.length > 0) {
        const opponentIds = unseen.map(g => g.player1_id === player.id ? g.player2_id : g.player1_id).filter(Boolean);
        const { data: opponentPlayers } = opponentIds.length > 0
          ? await supabase.from('players').select('id, username').in('id', opponentIds)
          : { data: [] };
        const nameMap: Record<string, string> = {};
        opponentPlayers?.forEach(p => { nameMap[p.id] = p.username; });

        setGameResults(unseen.map(g => ({
          id: g.id,
          opponentName: nameMap[g.player1_id === player.id ? g.player2_id : g.player1_id] || 'Opponent',
          didWin: g.winner_id === player.id,
          wager: g.wager || 0,
        })));
      } else {
        setGameResults([]);
      }
    }

    // Show system notifications for new items
    const inviteCount = inviteData?.length || 0;
    if (inviteCount > prevInviteCount.current && prevInviteCount.current >= 0) {
      if (document.visibilityState === 'hidden') {
        showNotification('STONE - Game Invite!', 'You have a new game invite!', 'game-invite');
      }
    }
    prevInviteCount.current = inviteCount;

    if (newFriendCount > prevFriendCount.current && prevFriendCount.current >= 0) {
      if (document.visibilityState === 'hidden') {
        showNotification('STONE - Friend Request', 'You have a new friend request!', 'friend-request');
      }
    }
    prevFriendCount.current = newFriendCount;
  }, [player]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [poll]);

  const handleAcceptInvite = async (invite: GameInvite) => {
    // Don't mark as accepted yet — that happens when we successfully join the game
    // Just dismiss from UI and navigate to the game
    setDismissed(prev => new Set(prev).add(invite.id));

    if (onAcceptInvite) {
      onAcceptInvite(invite.gameId, invite.roomCode, invite.id);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    await supabase
      .from('game_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    setDismissed(prev => new Set(prev).add(inviteId));
  };

  const handleDismissResult = (gameId: string) => {
    const seen: string[] = JSON.parse(localStorage.getItem('stone_seen_results') || '[]');
    seen.push(gameId);
    // Keep only last 50 to avoid unbounded growth
    localStorage.setItem('stone_seen_results', JSON.stringify(seen.slice(-50)));
    setDismissed(prev => new Set(prev).add(gameId));
  };

  const visibleInvites = invites.filter(i => !dismissed.has(i.id));
  const visibleResults = gameResults.filter(r => !dismissed.has(r.id));

  if (visibleInvites.length === 0 && visibleResults.length === 0 && friendRequests === 0) return null;

  return (
    <div className="fixed top-2 right-2 z-50 flex flex-col gap-2 max-w-xs">
      {/* Game invites */}
      {visibleInvites.map(invite => (
        <div key={invite.id}
          className="bg-[#504840] border-2 border-amber-600/60 rounded-xl p-3 shadow-2xl animate-[slideIn_0.3s_ease-out]">
          <p className="text-white text-sm font-heading mb-2">
            New game invite from <span className="text-amber-400">{invite.fromUsername}</span>
            {invite.wager > 0 && (
              <span className="text-amber-400/80 text-xs ml-1">({invite.wager} coin wager)</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleAcceptInvite(invite)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                         bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors"
            >
              Play Now!
            </button>
            <button
              onClick={() => handleDeclineInvite(invite.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                         bg-black/30 text-white/60 hover:text-white cursor-pointer transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Game result notifications */}
      {visibleResults.map(result => (
        <div key={result.id}
          className={`bg-[#504840] border-2 ${result.didWin ? 'border-green-600/60' : 'border-red-600/40'} rounded-xl p-3 shadow-2xl animate-[slideIn_0.3s_ease-out]`}>
          <p className="text-white text-sm font-heading mb-1">
            {result.didWin
              ? <>You beat <span className="text-green-400">{result.opponentName}</span>!</>
              : <><span className="text-red-400">{result.opponentName}</span> won the game</>
            }
          </p>
          {result.wager > 0 && (
            <p className={`text-xs mb-2 ${result.didWin ? 'text-green-400' : 'text-red-400'}`}>
              {result.didWin ? `+${result.wager} coins` : `-${result.wager} coins`}
            </p>
          )}
          <button
            onClick={() => handleDismissResult(result.id)}
            className="w-full px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-black/30 text-white/60 hover:text-white cursor-pointer transition-colors"
          >
            OK
          </button>
        </div>
      ))}

      {/* Friend request notification */}
      {friendRequests > 0 && (
        <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-xl px-3 py-2 shadow-2xl">
          <p className="text-white/70 text-xs">
            You have <span className="text-amber-400 font-heading">{friendRequests}</span> pending friend request{friendRequests > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
