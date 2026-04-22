import { useState, useEffect } from 'react';
import { ONLINE_WAGER_TIERS } from '../lib/coins';
import { useCoins } from '../contexts/CoinsContext';
import { useFriends, type Friend } from '../hooks/useFriends';
import JesterCoin from './JesterCoin';

interface OnlineLobbyProps {
  onlinePhase: 'idle' | 'waiting' | 'connecting' | 'playing' | 'error';
  roomCode: string;
  opponentConnected: boolean;
  error: string;
  onCreateRoom: (wager: number) => void;
  onJoinRoom: (code: string) => void;
  onBack: () => void;
  gameWager?: number;
  onInviteFriend?: (playerId: string, wager: number) => void;
}

function getJoinUrl(code: string): string {
  const base = window.location.origin;
  return `${base}/join/${code}`;
}

async function shareInvite(code: string) {
  const url = getJoinUrl(code);
  const text = `Join my STONE game!\n${url}`;

  // Try native share (mobile)
  if (navigator.share) {
    try {
      await navigator.share({ title: 'STONE Game Invite', text, url });
      return 'shared';
    } catch {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export default function OnlineLobby({
  onlinePhase, roomCode, opponentConnected, error,
  onCreateRoom, onJoinRoom, onBack, gameWager, onInviteFriend,
}: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle');
  const [selectedWager, setSelectedWager] = useState(0);
  const { coins, spend } = useCoins();
  const { friends, loadFriends } = useFriends();
  const [invitingFriend, setInvitingFriend] = useState<Friend | null>(null);
  const [friendInviteWager, setFriendInviteWager] = useState(0);

  useEffect(() => {
    if (onlinePhase === 'idle') loadFriends();
  }, [onlinePhase, loadFriends]);

  const handleFriendInvite = async () => {
    if (!invitingFriend || !onInviteFriend) return;
    if (friendInviteWager > 0) {
      const ok = await spend(friendInviteWager, `Online game wager (invite to ${invitingFriend.username})`);
      if (!ok) return;
    }
    onInviteFriend(invitingFriend.playerId, friendInviteWager);
    setInvitingFriend(null);
    setFriendInviteWager(0);
  };

  const handleShare = async () => {
    const result = await shareInvite(roomCode);
    setShareStatus(result);
    if (result === 'copied') {
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  if (onlinePhase === 'error') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />
        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-red-400 text-sm font-heading text-center">{error || 'Something went wrong'}</p>
          <button
            onClick={onBack}
            className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-[#504840] text-white border-2 border-[#6b5f55]
                       hover:bg-[#5e5549] hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (onlinePhase === 'connecting') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />
        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-white text-sm font-heading">Connecting to game...</p>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-white/40 text-[10px]">Room: {roomCode}</p>
          <button
            onClick={onBack}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (onlinePhase === 'waiting') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-white text-sm font-heading">Invite your opponent:</p>

          {/* Share button — primary action */}
          <button
            onClick={handleShare}
            className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-amber-600 text-white border-2 border-amber-500
                       hover:bg-amber-500 hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {shareStatus === 'copied' ? 'Copied to Clipboard!' : shareStatus === 'shared' ? 'Shared!' : 'Share Invite Link'}
          </button>

          {/* Room code as fallback */}
          <div className="flex flex-col items-center gap-1 mt-2">
            <p className="text-white/40 text-[10px]">Or share this code manually:</p>
            <div className="text-3xl font-heading tracking-[0.3em] text-amber-400 bg-black/30 px-5 py-2 rounded-lg select-all">
              {roomCode}
            </div>
          </div>

          {gameWager !== undefined && gameWager > 0 && (
            <p className="text-amber-400/80 text-xs font-heading mt-1 flex items-center gap-1 justify-center">Wager: {gameWager} <JesterCoin size={14} /> each (winner takes {gameWager * 2})</p>
          )}
          <p className="text-white/40 text-xs mt-2">
            {opponentConnected ? 'Opponent connected!' : 'Waiting for opponent to join...'}
          </p>
          {!opponentConnected && (
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <button
            onClick={onBack}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default: show create/join options
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        {/* Wager selection */}
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-white/60 text-xs font-heading">Wager</p>
          <div className="flex gap-2">
            {ONLINE_WAGER_TIERS.map(tier => {
              const canAfford = tier === 0 || (coins !== null && coins >= tier);
              return (
                <button
                  key={tier}
                  onClick={() => canAfford && setSelectedWager(tier)}
                  disabled={!canAfford}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading transition-all cursor-pointer
                    ${selectedWager === tier
                      ? 'bg-amber-600 text-white border-2 border-amber-400'
                      : 'bg-[#504840] text-white/60 border-2 border-[#6b5f55] hover:border-amber-600/40'}
                    disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {tier === 0 ? 'Free' : <span className="flex items-center gap-1">{tier} <JesterCoin size={12} /></span>}
                </button>
              );
            })}
          </div>
          {coins !== null && (
            <p className="text-white/40 text-[10px] flex items-center gap-1 justify-center">Your balance: {coins} <JesterCoin size={12} /></p>
          )}
        </div>

        <button
          onClick={() => onCreateRoom(selectedWager)}
          className="w-full px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                     bg-[#504840] text-white border-2 border-[#6b5f55]
                     hover:bg-[#5e5549] hover:scale-105 active:scale-95
                     transition-all cursor-pointer shadow-lg"
        >
          Create Game {selectedWager > 0 && `(${selectedWager} coins)`}
        </button>

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-xs">OR</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        <div className="flex flex-col gap-3 w-full">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            maxLength={6}
            className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                       text-center text-xl font-heading tracking-[0.2em] uppercase
                       placeholder:text-white/30 placeholder:tracking-normal placeholder:text-sm
                       focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button
            onClick={() => onJoinRoom(joinCode)}
            disabled={joinCode.length < 4}
            className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-[#504840] text-white border-2 border-[#6b5f55]
                       hover:bg-[#5e5549] hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Join Game
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}

        {/* Invite a friend */}
        {onInviteFriend && friends.length > 0 && (
          <>
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/40 text-xs">OR INVITE A FRIEND</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <div className="w-full space-y-1.5 max-h-[30vh] overflow-y-auto">
              {friends.map(f => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${f.isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-[#6b5f55]" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55]">
                        <span className="text-[9px] text-white/40 font-heading">{f.username[0].toUpperCase()}</span>
                      </div>
                    )}
                    <span className={`text-sm font-heading ${f.isOnline ? 'text-white' : 'text-white/60'}`}>{f.username}</span>
                  </div>
                  <button
                    onClick={() => { setInvitingFriend(f); setFriendInviteWager(0); }}
                    className="px-2 py-1 rounded text-[9px] font-heading uppercase tracking-wider
                               bg-amber-600/60 text-white hover:bg-amber-600 cursor-pointer transition-colors"
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
        >
          Back
        </button>
      </div>

      {/* Friend invite wager modal */}
      {invitingFriend && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
            <h2 className="text-white font-heading text-lg mb-1">Invite {invitingFriend.username}</h2>
            <p className="text-white/50 text-[10px] font-heading mb-2 mt-3">Set wager</p>
            <div className="flex gap-2 justify-center mb-4">
              {ONLINE_WAGER_TIERS.map(tier => {
                const canAfford = tier === 0 || (coins !== null && coins >= tier);
                return (
                  <button
                    key={tier}
                    onClick={() => canAfford && setFriendInviteWager(tier)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 rounded-lg text-xs font-heading transition-all cursor-pointer
                      ${friendInviteWager === tier
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
                Balance: {coins} <JesterCoin size={12} />
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={handleFriendInvite}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                Send Invite
              </button>
              <button onClick={() => { setInvitingFriend(null); setFriendInviteWager(0); }}
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
