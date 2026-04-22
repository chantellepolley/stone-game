import { useState, useEffect } from 'react';
import { useFriends } from '../hooks/useFriends';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { ONLINE_WAGER_TIERS } from '../lib/coins';
import JesterCoin from './JesterCoin';

interface FriendsListProps {
  onBack: () => void;
  onInviteToPlay?: (playerId: string, wager: number) => void;
}

export default function FriendsList({ onBack, onInviteToPlay }: FriendsListProps) {
  const { player } = usePlayerContext();
  const { coins, spend } = useCoins();
  const { friends, pendingRequests, loading, loadFriends, getPendingRequests, addFriend, acceptFriend } = useFriends();
  const [addInput, setAddInput] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteWager, setInviteWager] = useState(0);

  useEffect(() => {
    if (player) {
      loadFriends();
      getPendingRequests();
    }
  }, [player, loadFriends, getPendingRequests]);

  const handleAdd = async () => {
    const trimmed = addInput.trim();
    if (!trimmed) return;
    setAddLoading(true);
    const result = await addFriend(trimmed);
    setAddLoading(false);
    if (result === true) {
      setAddMsg('Friend request sent!');
      setAddInput('');
      setTimeout(() => setAddMsg(''), 3000);
    } else {
      setAddMsg(result);
      setTimeout(() => setAddMsg(''), 3000);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    await acceptFriend(friendshipId);
    await getPendingRequests();
  };

  const handleSendInvite = async () => {
    if (!invitingId || !onInviteToPlay) return;
    if (inviteWager > 0) {
      const friendName = friends.find(f => f.playerId === invitingId)?.username || 'friend';
      const ok = await spend(inviteWager, `Online game wager (invite to ${friendName})`);
      if (!ok) return;
    }
    onInviteToPlay(invitingId, inviteWager);
    setInvitingId(null);
    setInviteWager(0);
  };

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);

  const renderFriendRow = (f: typeof friends[0], isOnline: boolean) => (
    <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
        {f.avatarUrl ? (
          <img src={f.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
            <span className="text-[10px] text-white/40 font-heading">{f.username[0].toUpperCase()}</span>
          </div>
        )}
        <span className={`text-sm font-heading ${isOnline ? 'text-white' : 'text-white/60'}`}>{f.username}</span>
      </div>
      {onInviteToPlay && (
        <button
          onClick={() => { setInvitingId(f.playerId); setInviteWager(0); }}
          className="px-2 py-1 rounded text-[9px] font-heading uppercase tracking-wider
                     bg-amber-600/60 text-white hover:bg-amber-600 cursor-pointer transition-colors"
        >
          Invite
        </button>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full max-h-[70vh]">
        <p className="text-white font-heading text-lg">Friends</p>

        {/* Add Friend */}
        <div className="w-full flex gap-2">
          <input
            type="text"
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add friend by username..."
            maxLength={20}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-[#6b5f55] text-white text-sm
                       placeholder:text-white/30 focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={addLoading || !addInput.trim()}
            className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-amber-600 text-white hover:bg-amber-500 cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {addLoading ? '...' : 'Add'}
          </button>
        </div>
        {addMsg && (
          <p className={`text-xs ${addMsg.includes('sent') ? 'text-green-400' : 'text-red-400'}`}>{addMsg}</p>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-full">
          <button onClick={() => setTab('friends')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer
              ${tab === 'friends' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
            Friends ({friends.length})
          </button>
          <button onClick={() => setTab('requests')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer relative
              ${tab === 'requests' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : tab === 'friends' ? (
          <div className="w-full overflow-y-auto space-y-1.5 max-h-[40vh]">
            {friends.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">No friends yet. Add someone above!</p>
            ) : (
              <>
                {onlineFriends.length > 0 && (
                  <div className="text-[9px] text-green-400/60 uppercase tracking-wider px-1 pt-1">Online</div>
                )}
                {onlineFriends.map(f => renderFriendRow(f, true))}

                {offlineFriends.length > 0 && (
                  <div className="text-[9px] text-white/30 uppercase tracking-wider px-1 pt-2">Offline</div>
                )}
                {offlineFriends.map(f => renderFriendRow(f, false))}
              </>
            )}
          </div>
        ) : (
          /* Requests tab */
          <div className="w-full overflow-y-auto space-y-1.5 max-h-[40vh]">
            {pendingRequests.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">No pending requests</p>
            ) : (
              pendingRequests.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
                        <span className="text-[10px] text-white/40 font-heading">{r.username[0].toUpperCase()}</span>
                      </div>
                    )}
                    <span className="text-white text-sm font-heading">{r.username}</span>
                  </div>
                  <button
                    onClick={() => handleAccept(r.id)}
                    className="px-3 py-1 rounded text-[9px] font-heading uppercase tracking-wider
                               bg-green-600/60 text-white hover:bg-green-600 cursor-pointer transition-colors"
                  >
                    Accept
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2">
          Back
        </button>
      </div>

      {/* Wager picker modal */}
      {invitingId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-1">Invite to Play</h2>
            <p className="text-white/60 text-xs mb-4">
              {friends.find(f => f.playerId === invitingId)?.username || 'Friend'}
            </p>
            <p className="text-white/50 text-[10px] font-heading mb-2">Set wager</p>
            <div className="flex gap-2 justify-center mb-4">
              {ONLINE_WAGER_TIERS.map(tier => {
                const canAfford = tier === 0 || (coins !== null && coins >= tier);
                return (
                  <button
                    key={tier}
                    onClick={() => canAfford && setInviteWager(tier)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 rounded-lg text-xs font-heading transition-all cursor-pointer
                      ${inviteWager === tier
                        ? 'bg-amber-600 text-white border-2 border-amber-400'
                        : 'bg-black/30 text-white/60 border-2 border-[#6b5f55] hover:border-amber-600/40'}
                      disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {tier === 0 ? 'Free' : <span className="flex items-center gap-1">{tier} <JesterCoin size={12} /></span>}
                  </button>
                );
              })}
            </div>
            {coins !== null && (
              <p className="text-white/40 text-[10px] mb-4 flex items-center gap-1 justify-center">
                Your balance: {coins} <JesterCoin size={12} />
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={handleSendInvite}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                Send Invite
              </button>
              <button onClick={() => { setInvitingId(null); setInviteWager(0); }}
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
