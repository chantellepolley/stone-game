import { useState, useEffect } from 'react';
import Game from './components/Game';
import OnlineGame from './components/OnlineGame';
import UsernamePrompt from './components/UsernamePrompt';
import PlayerStats from './components/PlayerStats';
import Leaderboard from './components/Leaderboard';
import { usePlayer } from './hooks/usePlayer';
import { PlayerContext } from './contexts/PlayerContext';

type AppScreen = 'game' | 'online' | 'stats' | 'leaderboard';

function getJoinCodeFromURL(): string | null {
  const path = window.location.pathname;
  const joinMatch = path.match(/\/join\/([A-Za-z0-9]+)/);
  if (joinMatch) return joinMatch[1].toUpperCase();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  if (code) return code.toUpperCase();
  return null;
}

export default function App() {
  const playerHook = usePlayer();
  const { player, isLoading, createPlayer } = playerHook;
  const [screen, setScreen] = useState<AppScreen>('game');
  const [autoJoinCode, setAutoJoinCode] = useState<string | null>(null);

  useEffect(() => {
    const code = getJoinCodeFromURL();
    if (code) {
      setAutoJoinCode(code);
      setScreen('online');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <PlayerContext.Provider value={playerHook}>
      {/* Username prompt for first-time visitors */}
      {!player && <UsernamePrompt onSubmit={createPlayer} />}

      {screen === 'stats' && <PlayerStats onBack={() => setScreen('game')} />}
      {screen === 'leaderboard' && <Leaderboard onBack={() => setScreen('game')} />}
      {screen === 'online' && (
        <OnlineGame
          onBack={() => { setScreen('game'); setAutoJoinCode(null); }}
          autoJoinCode={autoJoinCode}
        />
      )}
      {screen === 'game' && (
        <Game
          onPlayOnline={() => setScreen('online')}
          onShowStats={() => setScreen('stats')}
          onShowLeaderboard={() => setScreen('leaderboard')}
        />
      )}
    </PlayerContext.Provider>
  );
}
