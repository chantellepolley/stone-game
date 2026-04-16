import { useState } from 'react';

interface OnlineLobbyProps {
  onlinePhase: 'idle' | 'creating' | 'waiting' | 'joining' | 'playing' | 'error';
  roomCode: string;
  opponentConnected: boolean;
  error: string;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onBack: () => void;
}

export default function OnlineLobby({
  onlinePhase, roomCode, opponentConnected, error,
  onCreateRoom, onJoinRoom, onBack,
}: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');

  if (onlinePhase === 'waiting') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
        <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-white text-sm font-heading">Share this code with your opponent:</p>
          <div className="text-4xl font-heading tracking-[0.3em] text-amber-400 bg-black/30 px-6 py-3 rounded-lg select-all">
            {roomCode}
          </div>
          <p className="text-white/40 text-xs">
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
        {/* Create room */}
        <button
          onClick={onCreateRoom}
          className="w-full px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                     bg-[#504840] text-white border-2 border-[#6b5f55]
                     hover:bg-[#5e5549] hover:scale-105 active:scale-95
                     transition-all cursor-pointer shadow-lg"
        >
          Create Game
        </button>

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-xs">OR</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Join room */}
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
