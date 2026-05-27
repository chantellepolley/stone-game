import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useFriends } from '../hooks/useFriends';
import JesterCoin from './JesterCoin';

interface PlayerProfileProps {
  playerId: string;
  onClose: () => void;
  onInviteToPlay?: (playerId: string, wager: number) => void;
}

interface ProfileData {
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  games_played: number;
  pieces_captured: number;
  pieces_borne_off: number;
  best_win_streak: number;
  coins: number;
}

export default function PlayerProfile({ playerId, onClose, onInviteToPlay }: PlayerProfileProps) {
  const { player } = usePlayerContext();
  const { addFriendById, getFriendStatus } = useFriends();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'loading'>('loading');
  const [loading, setLoading] = useState(true);
  const [friendMsg, setFriendMsg] = useState('');

  const isMe = player?.id === playerId;

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('players').select('username, avatar_url').eq('id', playerId).single(),
        supabase.from('player_stats').select('wins, losses, games_played, pieces_captured, pieces_borne_off, best_win_streak, coins').eq('player_id', playerId).single(),
      ]);

      if (p && s) {
        setProfile({
          username: p.username,
          avatar_url: p.avatar_url,
          wins: s.wins || 0,
          losses: s.losses || 0,
          games_played: s.games_played || 0,
          pieces_captured: s.pieces_captured || 0,
          pieces_borne_off: s.pieces_borne_off || 0,
          best_win_streak: s.best_win_streak || 0,
          coins: s.coins || 0,
        });
      }

      if (!isMe) {
        const status = await getFriendStatus(playerId);
        setFriendStatus(status);
      }
      setLoading(false);
    }
    load();
  }, [playerId, isMe, getFriendStatus]);

  const handleAddFriend = async () => {
    const result = await addFriendById(playerId);
    if (result === true) {
      setFriendStatus('pending');
      setFriendMsg('Friend request sent!');
    } else if (result === 'Already friends') {
      setFriendStatus('accepted');
      setFriendMsg('Already friends');
    } else if (result === 'Friend invite already sent') {
      setFriendStatus('pending');
      setFriendMsg('Request already sent');
    } else {
      setFriendMsg(result);
    }
    setTimeout(() => setFriendMsg(''), 3000);
  };

  const winPct = profile && profile.games_played > 0
    ? Math.round((profile.wins / profile.games_played) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm w-full"
        onClick={e => e.stopPropagation()}>

        {loading || !profile ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 mb-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-600/40" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#3d3632] border-2 border-amber-600/40 flex items-center justify-center">
                  <span className="text-xl text-white/40 font-heading">{profile.username[0].toUpperCase()}</span>
                </div>
              )}
              <div>
                <h2 className="text-white font-heading text-lg">{profile.username}</h2>
                {isMe && <span className="text-amber-400/60 text-[10px] font-heading uppercase">You</span>}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-amber-400 font-heading text-lg">{profile.wins}</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Wins</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-white/70 font-heading text-lg">{profile.losses}</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Losses</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-green-400 font-heading text-lg">{winPct}%</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Win Rate</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-white/70 font-heading text-lg">{profile.games_played}</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Games</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-red-400 font-heading text-lg">{profile.pieces_captured}</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Captures</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <div className="text-amber-400 font-heading text-lg">{profile.best_win_streak}</div>
                <div className="text-white/40 text-[9px] uppercase tracking-wider">Best Streak</div>
              </div>
            </div>

            {/* Actions */}
            {!isMe && (
              <div className="flex flex-col gap-2">
                {friendStatus === 'none' && (
                  <button onClick={handleAddFriend}
                    className="w-full px-4 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                               bg-green-600/70 text-white hover:bg-green-600 cursor-pointer transition-colors">
                    Add Friend
                  </button>
                )}
                {friendStatus === 'pending' && (
                  <div className="w-full px-4 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                                  bg-black/20 text-white/40 text-center">
                    Friend Request Pending
                  </div>
                )}
                {friendStatus === 'accepted' && (
                  <div className="w-full px-4 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                                  bg-green-900/30 text-green-400/70 text-center">
                    Friends
                  </div>
                )}
                {onInviteToPlay && (
                  <button onClick={() => { onInviteToPlay(playerId, 0); onClose(); }}
                    className="w-full px-4 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
                               bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                    Invite to Play
                  </button>
                )}
                {friendMsg && (
                  <p className="text-center text-xs text-amber-400/80">{friendMsg}</p>
                )}
              </div>
            )}

            {/* Close */}
            <button onClick={onClose}
              className="w-full mt-3 px-4 py-2 rounded-lg font-heading text-xs uppercase tracking-wider
                         bg-black/20 text-white/50 hover:text-white cursor-pointer transition-colors">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
