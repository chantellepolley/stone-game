import { useState, useEffect } from 'react';
import { useFriends } from '../hooks/useFriends';
import { usePlayerContext } from '../contexts/PlayerContext';

interface FriendsListProps {
  onBack: () => void;
  onInviteToPlay?: (playerId: string) => void;
}

export default function FriendsList({ onBack, onInviteToPlay }: FriendsListProps) {
  const { player } = usePlayerContext();
  const { friends, pendingRequests, loading, loadFriends, getPendingRequests, addFriend, acceptFriend } = useFriends();
  const [addInput, setAddInput] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

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

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);

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
                {/* Online friends first */}
                {onlineFriends.length > 0 && (
                  <div className="text-[9px] text-green-400/60 uppercase tracking-wider px-1 pt-1">Online</div>
                )}
                {onlineFriends.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
                          <span className="text-[10px] text-white/40 font-heading">{f.username[0].toUpperCase()}</span>
                        </div>
                      )}
                      <span className="text-white text-sm font-heading">{f.username}</span>
                    </div>
                    {onInviteToPlay && (
                      <button
                        onClick={() => onInviteToPlay(f.playerId)}
                        className="px-2 py-1 rounded text-[9px] font-heading uppercase tracking-wider
                                   bg-amber-600/60 text-white hover:bg-amber-600 cursor-pointer transition-colors"
                      >
                        Invite
                      </button>
                    )}
                  </div>
                ))}

                {/* Offline friends */}
                {offlineFriends.length > 0 && (
                  <div className="text-[9px] text-white/30 uppercase tracking-wider px-1 pt-2">Offline</div>
                )}
                {offlineFriends.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#6b5f55]" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
                          <span className="text-[10px] text-white/40 font-heading">{f.username[0].toUpperCase()}</span>
                        </div>
                      )}
                      <span className="text-white/60 text-sm font-heading">{f.username}</span>
                    </div>
                    {onInviteToPlay && (
                      <button
                        onClick={() => onInviteToPlay(f.playerId)}
                        className="px-2 py-1 rounded text-[9px] font-heading uppercase tracking-wider
                                   bg-amber-600/60 text-white hover:bg-amber-600 cursor-pointer transition-colors"
                      >
                        Invite
                      </button>
                    )}
                  </div>
                ))}
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
    </div>
  );
}
