import { useState } from 'react';
import Game from './components/Game';
import OnlineGame from './components/OnlineGame';

type AppScreen = 'local' | 'online';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('local');

  if (screen === 'online') {
    return <OnlineGame onBack={() => setScreen('local')} />;
  }

  return <Game onPlayOnline={() => setScreen('online')} />;
}
