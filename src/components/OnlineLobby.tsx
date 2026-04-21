import { useState } from 'react';
import { ONLINE_WAGER_TIERS } from '../lib/coins';
import { useCoins } from '../contexts/CoinsContext';

interface OnlineLobbyProps {
  onlinePhase: 'idle' | 'waiting' | 'connecting' | 'playing' | 'error';
  roomCode: string;
  opponentConnected: boolean;
  error: string;
  onCreateRoom: (wager: number) => void;
  onJoinRoom: (code: string) => void;
  onBack: () => void;
  gameWager?: number;
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
  onCreateRoom, onJoinRoom, onBack, gameWager,
}: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle');
  const [selectedWager, setSelectedWager] = useState(0);
  const { coins } = useCoins();

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
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />
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
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />
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
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

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
            <p className="text-amber-400/80 text-xs font-heading mt-1">Wager: {gameWager} &#x1FA99; each (winner takes {gameWager * 2})</p>
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
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

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
                  {tier === 0 ? 'Free' : `${tier}`} {tier > 0 && <span className="text-amber-400/80">&#x1FA99;</span>}
                </button>
              );
            })}
          </div>
          {coins !== null && (
            <p className="text-white/40 text-[10px]">Your balance: {coins} &#x1FA99;</p>
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

        <button
          onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
        >
          Back
        </button>
      </div>
    </div>
  );
}
