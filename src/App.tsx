import { useState, useEffect } from 'react';
import Game from './components/Game';
import OnlineGame from './components/OnlineGame';

type AppScreen = 'local' | 'online';

/** Extract join code from URL like /join/KR7NP or ?join=KR7NP */
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
  const [screen, setScreen] = useState<AppScreen>('local');
  const [autoJoinCode, setAutoJoinCode] = useState<string | null>(null);

  // Check URL for join code on mount
  useEffect(() => {
    const code = getJoinCodeFromURL();
    if (code) {
      setAutoJoinCode(code);
      setScreen('online');
      // Clean URL without reload
      window.history.replaceState({}, '', '/');
    }
  }, []);

  if (screen === 'online') {
    return (
      <OnlineGame
        onBack={() => { setScreen('local'); setAutoJoinCode(null); }}
        autoJoinCode={autoJoinCode}
      />
    );
  }

  return <Game onPlayOnline={() => setScreen('online')} />;
}
