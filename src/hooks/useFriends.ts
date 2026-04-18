import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';

export interface Friend {
  id: string;           // friendship row id
  playerId: string;     // the friend's player id
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  status: 'pending' | 'accepted';
}

export interface FriendRequest {
  id: string;           // friendship row id
  fromPlayerId: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

export function useFriends() {
  const { player } = usePlayerContext();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!player) return;
    setLoading(true);

    // Get accepted friendships where I am either player_id or friend_id
    const { data: friendships } = await supabase
      .from('friends')
      .select('id, player_id, friend_id, status')
      .or(`player_id.eq.${player.id},friend_id.eq.${player.id}`)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // Collect friend player IDs
    const friendPlayerIds = friendships.map(f =>
      f.player_id === player.id ? f.friend_id : f.player_id
    );

    // Fetch player info
    const { data: players } = await supabase
      .from('players')
      .select('id, username, avatar_url')
      .in('id', friendPlayerIds);

    const playerMap: Record<string, { username: string; avatar_url: string | null }> = {};
    players?.forEach(p => { playerMap[p.id] = { username: p.username, avatar_url: p.avatar_url }; });

    // Check online status: friends with an active game updated in last 5 min
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: activeGames } = await supabase
      .from('games')
      .select('player1_id, player2_id')
      .in('status', ['active', 'waiting'])
      .gte('updated_at', fiveMinAgo);

    const onlinePlayerIds = new Set<string>();
    activeGames?.forEach(g => {
      if (g.player1_id) onlinePlayerIds.add(g.player1_id);
      if (g.player2_id) onlinePlayerIds.add(g.player2_id);
    });

    const result: Friend[] = friendships.map(f => {
      const friendId = f.player_id === player.id ? f.friend_id : f.player_id;
      const info = playerMap[friendId];
      return {
        id: f.id,
        playerId: friendId,
        username: info?.username || 'Unknown',
        avatarUrl: info?.avatar_url || null,
        isOnline: onlinePlayerIds.has(friendId),
        status: f.status as 'pending' | 'accepted',
      };
    });

    setFriends(result);
    setLoading(false);
  }, [player]);

  const getPendingRequests = useCallback(async () => {
    if (!player) return;

    // Incoming friend requests: where friend_id = me and status = pending
    const { data: requests } = await supabase
      .from('friends')
      .select('id, player_id, created_at')
      .eq('friend_id', player.id)
      .eq('status', 'pending');

    if (!requests || requests.length === 0) {
      setPendingRequests([]);
      return;
    }

    const fromIds = requests.map(r => r.player_id);
    const { data: players } = await supabase
      .from('players')
      .select('id, username, avatar_url')
      .in('id', fromIds);

    const playerMap: Record<string, { username: string; avatar_url: string | null }> = {};
    players?.forEach(p => { playerMap[p.id] = { username: p.username, avatar_url: p.avatar_url }; });

    const result: FriendRequest[] = requests.map(r => ({
      id: r.id,
      fromPlayerId: r.player_id,
      username: playerMap[r.player_id]?.username || 'Unknown',
      avatarUrl: playerMap[r.player_id]?.avatar_url || null,
      createdAt: r.created_at,
    }));

    setPendingRequests(result);
  }, [player]);

  const addFriend = useCallback(async (username: string): Promise<string | true> => {
    if (!player) return 'Not logged in';

    // Look up the target player by username (case-insensitive)
    const { data: targets } = await supabase
      .from('players')
      .select('id, username')
      .ilike('username', username);

    if (!targets || targets.length === 0) return 'Player not found';

    const target = targets[0];
    if (target.id === player.id) return 'You cannot add yourself';

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friends')
      .select('id, status')
      .or(`and(player_id.eq.${player.id},friend_id.eq.${target.id}),and(player_id.eq.${target.id},friend_id.eq.${player.id})`);

    if (existing && existing.length > 0) {
      const f = existing[0];
      if (f.status === 'accepted') return 'Already friends';
      return 'Friend invite already sent';
    }

    // Insert friend request
    const { error } = await supabase
      .from('friends')
      .insert({ player_id: player.id, friend_id: target.id, status: 'pending' });

    if (error) return error.message;
    return true;
  }, [player]);

  const addFriendById = useCallback(async (targetId: string): Promise<string | true> => {
    if (!player) return 'Not logged in';
    if (targetId === player.id) return 'You cannot add yourself';

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friends')
      .select('id, status')
      .or(`and(player_id.eq.${player.id},friend_id.eq.${targetId}),and(player_id.eq.${targetId},friend_id.eq.${player.id})`);

    if (existing && existing.length > 0) {
      const f = existing[0];
      if (f.status === 'accepted') return 'Already friends';
      return 'Friend invite already sent';
    }

    const { error } = await supabase
      .from('friends')
      .insert({ player_id: player.id, friend_id: targetId, status: 'pending' });

    if (error) return error.message;
    return true;
  }, [player]);

  const getFriendStatus = useCallback(async (targetId: string): Promise<'none' | 'pending' | 'accepted'> => {
    if (!player) return 'none';
    const { data } = await supabase
      .from('friends')
      .select('id, status')
      .or(`and(player_id.eq.${player.id},friend_id.eq.${targetId}),and(player_id.eq.${targetId},friend_id.eq.${player.id})`)
      .limit(1);
    if (!data || data.length === 0) return 'none';
    return data[0].status as 'pending' | 'accepted';
  }, [player]);

  // Backward compat wrapper
  const isFriend = useCallback(async (targetId: string): Promise<boolean> => {
    const status = await getFriendStatus(targetId);
    return status === 'accepted';
  }, [getFriendStatus]);

  const acceptFriend = useCallback(async (friendshipId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (!error) {
      setPendingRequests(prev => prev.filter(r => r.id !== friendshipId));
      await loadFriends();
      return true;
    }
    return false;
  }, [loadFriends]);

  const getOnlineFriends = useCallback((): Friend[] => {
    return friends.filter(f => f.isOnline);
  }, [friends]);

  return {
    friends,
    pendingRequests,
    loading,
    loadFriends,
    getPendingRequests,
    addFriend,
    addFriendById,
    isFriend,
    getFriendStatus,
    acceptFriend,
    getOnlineFriends,
  };
}
