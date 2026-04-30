import { useState, useEffect } from 'react';
import { getMonthlyStandings, getCurrentMonth, getTimeUntilMonthEnd, getTimeUntilCompetitionStart, hasCompetitionStarted, formatMonthName } from '../lib/monthlyPoints';
import { CHAMPION_STONES } from '../utils/stoneColors';
import { usePlayerContext } from '../contexts/PlayerContext';

const CHAMPION_CLIP = 'polygon(50% 0%, 65% 25%, 100% 15%, 75% 40%, 100% 50%, 75% 60%, 100% 85%, 65% 75%, 50% 100%, 35% 75%, 0% 85%, 25% 60%, 0% 50%, 25% 40%, 0% 15%, 35% 25%)';

interface StandingEntry {
  player_id: string;
  points: number;
  wins_online: number;
  wins_ai_hard: number;
  wins_ai_expert: number;
  forfeits: number;
  login_days: number;
  qualified: boolean;
  username?: string;
  avatar_url?: string | null;
}

export default function MonthlyStandings({ onBack, onShowHallOfFame }: { onBack: () => void; onShowHallOfFame?: () => void }) {
  const { player } = usePlayerContext();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [started, setStarted] = useState(hasCompetitionStarted());

  useEffect(() => {
    if (started) {
      getMonthlyStandings().then(data => {
        setStandings(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [started]);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const isStarted = hasCompetitionStarted();
      setStarted(isStarted);

      const ms = isStarted ? getTimeUntilMonthEnd() : getTimeUntilCompetitionStart();
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else {
        setCountdown(`${hours}h ${mins}m ${secs}s`);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const month = getCurrentMonth();
  const qualifiedEntries = standings.filter(s => s.qualified);
  const unqualifiedEntries = standings.filter(s => !s.qualified && s.points > 0);
  const myEntry = standings.find(s => s.player_id === player?.id);
  const myRank = qualifiedEntries.findIndex(s => s.player_id === player?.id) + 1;

  // Pre-competition view
  if (!started) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-4 py-4">
        <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer shrink-0" onClick={onBack} />

        <div className="flex flex-col items-center gap-5 bg-[#504840] border-2 border-amber-600/40 rounded-xl p-6 sm:p-8 shadow-lg max-w-md w-full">
          <div className="text-center">
            <p className="text-amber-400 font-heading text-xl">Player of the Month</p>
            <p className="text-white/70 text-sm mt-2">Introducing the Player of the Month competition!</p>
          </div>

          <p className="text-white/50 text-xs text-center leading-relaxed">
            Compete each month for the title of STONE's top player. Earn points by winning games,
            building streaks, and mastering the Jester dice. The winner receives an exclusive champion
            stone with a unique design that no one else can get — ever.
          </p>

          {/* May champion stone preview */}
          {(() => {
            const mayStone = CHAMPION_STONES.find(s => s.championMonth === '2026-05');
            if (!mayStone) return null;
            return (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-heading">May's Champion Stone</p>
                <div
                  className="w-16 h-16 relative overflow-hidden"
                  style={{
                    backgroundImage: "url('/stone-bg.jpg')",
                    backgroundSize: '80px',
                    filter: 'brightness(1.3) contrast(1.1)',
                    clipPath: CHAMPION_CLIP,
                    boxShadow: '0 0 16px rgba(255,200,0,0.4)',
                  }}>
                  <div className="absolute inset-0" style={{ background: mayStone.gradient }} />
                  <div className="absolute inset-0" style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.5)' }} />
                </div>
                <p className="text-amber-400 text-xs font-heading">{mayStone.name}</p>
              </div>
            );
          })()}

          {/* Countdown to start */}
          <div className="bg-black/20 rounded-lg px-5 py-3 text-center w-full">
            <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-heading">First competition begins</p>
            <p className="text-white font-heading text-lg mt-1">{countdown}</p>
            <p className="text-[9px] text-white/30 mt-1">May 1, 2026 at 12:00 AM UTC</p>
          </div>

          {/* How points work */}
          <div className="w-full">
            <p className="text-amber-400/60 text-[10px] font-heading uppercase tracking-wider text-center mb-2">How to earn points</p>
            <div className="bg-black/20 rounded-lg p-3 text-[9px] text-white/50 space-y-1">
              <p><span className="text-white/70">Online win:</span> +3 pts (+1 wagered, +1 at 25, +1 at 50, +2 at 100)</p>
              <p><span className="text-white/70">Expert AI win:</span> +2 pts</p>
              <p><span className="text-white/70">Hard AI win:</span> +1 pt</p>
              <p><span className="text-white/70">Win streak 3/5/10:</span> +2/+5/+10 pts</p>
              <p><span className="text-white/70">Perfect game:</span> +3 pts</p>
              <p><span className="text-white/70">Speed win:</span> +2 pts</p>
              <p><span className="text-white/70">Jester master:</span> +1 pt</p>
              <p><span className="text-white/70">Daily login:</span> +1 pt</p>
              <p><span className="text-red-400/70">Forfeit:</span> -2 pts</p>
              <p className="text-white/30 mt-2">Qualify at 15 points. Easy/Medium AI wins = 0 pts.</p>
            </div>
          </div>

          {onShowHallOfFame && (
            <button onClick={onShowHallOfFame}
              className="px-5 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         bg-[#5e5549] text-amber-400 hover:bg-[#6b5f55] cursor-pointer transition-colors">
              Hall of Fame
            </button>
          )}

          <button onClick={onBack}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer shrink-0">
            Back
          </button>
        </div>
      </div>
    );
  }

  // Active competition view
  const monthName = formatMonthName(month);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 px-4 py-4">
      <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer shrink-0" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full overflow-y-auto max-h-[75vh]">
        <div className="text-center">
          <p className="text-amber-400 font-heading text-lg">Player of the Month</p>
          <p className="text-white/60 text-xs">{monthName}</p>
        </div>

        {/* Countdown */}
        <div className="bg-black/20 rounded-lg px-4 py-2 text-center w-full">
          <p className="text-[9px] text-white/40 uppercase tracking-wider font-heading">Competition ends (UTC midnight)</p>
          <p className="text-white font-heading text-sm">{countdown}</p>
        </div>

        {/* My status */}
        {player && (
          <div className="bg-black/20 rounded-lg px-4 py-2 w-full">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Your points:</span>
              <span className="text-amber-400 font-heading text-sm">{myEntry?.points || 0}</span>
            </div>
            {myEntry?.qualified ? (
              <p className="text-green-400 text-[10px] mt-1">Qualified! Rank #{myRank}</p>
            ) : (
              <p className="text-white/40 text-[10px] mt-1">
                {15 - (myEntry?.points || 0)} more points to qualify
              </p>
            )}
          </div>
        )}

        {/* Point system info */}
        <details className="w-full">
          <summary className="text-amber-400/60 text-[10px] font-heading cursor-pointer hover:text-amber-400 transition-colors">
            How points work
          </summary>
          <div className="mt-2 bg-black/20 rounded-lg p-3 text-[9px] text-white/50 space-y-1">
            <p><span className="text-white/70">Online win:</span> +3 pts (+1 wagered, +1 at 25, +1 at 50, +2 at 100)</p>
            <p><span className="text-white/70">Expert AI win:</span> +2 pts</p>
            <p><span className="text-white/70">Hard AI win:</span> +1 pt</p>
            <p><span className="text-white/70">Win streak 3/5/10:</span> +2/+5/+10 pts</p>
            <p><span className="text-white/70">Perfect game:</span> +3 pts</p>
            <p><span className="text-white/70">Speed win:</span> +2 pts</p>
            <p><span className="text-white/70">Jester master:</span> +1 pt</p>
            <p><span className="text-white/70">Daily login:</span> +1 pt</p>
            <p><span className="text-red-400/70">Forfeit:</span> -2 pts</p>
            <p className="text-white/30 mt-2">Qualify at 15 points. Easy/Medium AI wins = 0 pts.</p>
          </div>
        </details>

        {loading ? (
          <p className="text-white/40 text-sm">Loading standings...</p>
        ) : qualifiedEntries.length === 0 && unqualifiedEntries.length === 0 ? (
          <p className="text-white/40 text-sm">No entries yet. Start playing to earn points!</p>
        ) : (
          <>
            {/* Qualified standings */}
            {qualifiedEntries.length > 0 && (
              <div className="w-full space-y-1.5">
                {qualifiedEntries.map((entry, i) => (
                  <div key={entry.player_id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                      entry.player_id === player?.id ? 'bg-amber-600/20 border border-amber-600/30' : 'bg-black/20'
                    }`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-sm font-heading w-6 text-center ${
                        i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-white/40'
                      }`}>
                        {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}`}
                      </span>
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-[#6b5f55] shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55] shrink-0">
                          <span className="text-xs font-heading text-white/40">{entry.username?.[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-sm font-heading truncate">{entry.username}</div>
                        <div className="text-[8px] text-white/30">
                          {entry.wins_online}W online, {entry.wins_ai_expert}W expert, {entry.login_days}d streak
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="text-amber-400 font-heading text-sm">{entry.points}</span>
                      <span className="text-[8px] text-white/30">pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unqualified entries */}
            {unqualifiedEntries.length > 0 && (
              <>
                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-[9px]">Not yet qualified (need 15 pts)</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div className="w-full space-y-1">
                  {unqualifiedEntries.map(entry => (
                    <div key={entry.player_id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                        entry.player_id === player?.id ? 'bg-white/5 border border-white/10' : 'bg-black/10'
                      }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#3d3632] flex items-center justify-center border border-[#6b5f55] shrink-0 opacity-50">
                          <span className="text-[9px] font-heading text-white/40">{entry.username?.[0]?.toUpperCase()}</span>
                        </div>
                        <span className="text-white/40 text-xs truncate">{entry.username}</span>
                      </div>
                      <span className="text-white/30 text-xs font-heading">{entry.points} pts</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Prize info with stone preview */}
        {(() => {
          const currentStone = CHAMPION_STONES.find(s => s.championMonth === month);
          return (
            <div className="bg-black/20 rounded-lg px-4 py-3 text-center w-full">
              <p className="text-[9px] text-white/40 uppercase tracking-wider font-heading">Monthly prize</p>
              {currentStone && (
                <div className="flex items-center justify-center gap-3 mt-2">
                  <div
                    className="w-12 h-12 relative overflow-hidden shrink-0"
                    style={{
                      backgroundImage: "url('/stone-bg.jpg')",
                      backgroundSize: '60px',
                      filter: 'brightness(1.3) contrast(1.1)',
                      clipPath: CHAMPION_CLIP,
                      boxShadow: '0 0 12px rgba(255,200,0,0.3)',
                    }}>
                    <div className="absolute inset-0" style={{ background: currentStone.gradient }} />
                  </div>
                  <div className="text-left">
                    <p className="text-amber-400 text-xs font-heading">{currentStone.name}</p>
                    <p className="text-white/40 text-[9px]">Exclusive champion stone</p>
                  </div>
                </div>
              )}
              {!currentStone && (
                <p className="text-white/60 text-xs mt-1">Winner receives an exclusive champion stone!</p>
              )}
            </div>
          );
        })()}

        {onShowHallOfFame && (
          <button onClick={onShowHallOfFame}
            className="px-5 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-[#5e5549] text-amber-400 hover:bg-[#6b5f55] cursor-pointer transition-colors">
            Hall of Fame
          </button>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2 shrink-0">
          Back
        </button>
      </div>
    </div>
  );
}
