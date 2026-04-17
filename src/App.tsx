import { useState, useEffect } from 'react';
import Game from './components/Game';
import OnlineGame from './components/OnlineGame';
import UsernamePrompt from './components/UsernamePrompt';
import PlayerStats from './components/PlayerStats';
import Leaderboard from './components/Leaderboard';
import MyGames from './components/MyGames';
import ColorPicker from './components/ColorPicker';
import { loadPlayerColor, savePlayerColor } from './utils/stoneColors';
import { usePlayer } from './hooks/usePlayer';
import { PlayerContext } from './contexts/PlayerContext';

type AppScreen = 'game' | 'online' | 'stats' | 'leaderboard' | 'my-games' | 'colors';

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
  const [resumeData, setResumeData] = useState<{ gameId: string; roomCode: string; player: 1 | 2 } | null>(null);
  const [resumeLocalGameId, setResumeLocalGameId] = useState<string | null>(null);
  const [stoneColor, setStoneColor] = useState(loadPlayerColor());

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

      {screen === 'colors' && (
        <ColorPicker
          selectedId={stoneColor}
          onSelect={(id) => { setStoneColor(id); savePlayerColor(id); }}
          onBack={() => setScreen('game')}
        />
      )}
      {screen === 'stats' && <PlayerStats onBack={() => setScreen('game')} />}
      {screen === 'leaderboard' && <Leaderboard onBack={() => setScreen('game')} />}
      {screen === 'my-games' && (
        <MyGames
          onResume={(gameId, roomCode, player, mode) => {
            if (mode === 'ai' || mode === 'local') {
              setResumeLocalGameId(gameId);
              setScreen('game');
            } else {
              setResumeData({ gameId, roomCode, player });
              setScreen('online');
            }
          }}
          onBack={() => setScreen('game')}
        />
      )}
      {screen === 'online' && (
        <OnlineGame
          onBack={() => { setScreen('game'); setAutoJoinCode(null); setResumeData(null); }}
          autoJoinCode={autoJoinCode}
          resumeData={resumeData}
        />
      )}
      {screen === 'game' && (
        <Game
          onPlayOnline={() => setScreen('online')}
          onShowStats={() => setScreen('stats')}
          onShowLeaderboard={() => setScreen('leaderboard')}
          onShowMyGames={() => { setResumeLocalGameId(null); setScreen('my-games'); }}
          onShowColors={() => setScreen('colors')}
          resumeGameId={resumeLocalGameId}
        />
      )}
    </PlayerContext.Provider>
  );
}
