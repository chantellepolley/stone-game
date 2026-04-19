import { useState, useEffect, useCallback } from 'react';
import Game from './components/Game';
import OnlineGame from './components/OnlineGame';
import UsernamePrompt from './components/UsernamePrompt';
import PlayerStats from './components/PlayerStats';
import Leaderboard from './components/Leaderboard';
import MyGames from './components/MyGames';
import ColorPicker from './components/ColorPicker';
import FriendsList from './components/FriendsList';
import Notifications from './components/Notifications';
import ErrorBoundary from './components/ErrorBoundary';
import { TermsPage, PrivacyPage } from './components/LegalPages';
import FeedbackPanel from './components/FeedbackPanel';
import Tutorial from './components/Tutorial';
import { loadPlayerColor, savePlayerColor } from './utils/stoneColors';
import { usePlayer } from './hooks/usePlayer';
import { PlayerContext } from './contexts/PlayerContext';
import { supabase } from './lib/supabase';
import { createInitialState } from './engine';

type AppScreen = 'game' | 'online' | 'stats' | 'leaderboard' | 'my-games' | 'colors' | 'friends' | 'terms' | 'privacy' | 'feedback' | 'tutorial';

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
  const { player, isLoading } = playerHook;
  const [screen, setScreen] = useState<AppScreen>('game');
  const [autoJoinCode, setAutoJoinCode] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<{ gameId: string; roomCode: string; player: 1 | 2 } | null>(null);
  const [resumeLocalGameId, setResumeLocalGameId] = useState<string | null>(null);
  const [stoneColor, setStoneColor] = useState(loadPlayerColor());
  const [pendingNotifications, setPendingNotifications] = useState(0);

  // Poll for pending notifications (invites + your-turn games)
  const pollNotifications = useCallback(async () => {
    if (!player) return;
    let count = 0;

    // Count pending game invites only
    const { count: inviteCount } = await supabase
      .from('game_invites')
      .select('id', { count: 'exact', head: true })
      .eq('to_player_id', player.id)
      .eq('status', 'pending');
    count += (inviteCount || 0);

    // Count games where it's my turn
    const { data: activeGames } = await supabase
      .from('games')
      .select('id, state, player1_id')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .in('status', ['active'])
      .limit(20);

    if (activeGames) {
      for (const g of activeGames) {
        const myPlayer = g.player1_id === player.id ? 1 : 2;
        const currentPlayer = (g.state as any)?.currentPlayer;
        if (currentPlayer === myPlayer) count++;
      }
    }

    setPendingNotifications(count);
  }, [player]);

  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);
    return () => clearInterval(interval);
  }, [pollNotifications]);

  const handleInviteToPlay = useCallback(async (toPlayerId: string) => {
    if (!player) return;

    // Generate room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];

    // Create the game
    const { data: game, error: gameErr } = await supabase.from('games').insert({
      room_code: code,
      player1_id: player.id,
      mode: 'online',
      state: { ...createInitialState(), phase: 'rolling', gameMode: 'pvp' },
      status: 'waiting',
    }).select('id').single();

    if (gameErr || !game) {
      alert(gameErr?.message || 'Failed to create game');
      return;
    }

    // Create invite
    const { error: inviteErr } = await supabase.from('game_invites').insert({
      from_player_id: player.id,
      to_player_id: toPlayerId,
      game_id: game.id,
      room_code: code,
      status: 'pending',
    });

    if (inviteErr) {
      alert(inviteErr.message);
    } else {
      alert('Game invite sent!');
    }
  }, [player]);

  const handleAcceptNotificationInvite = useCallback((gameId: string, roomCode: string) => {
    setResumeData({ gameId, roomCode, player: 2 });
    setScreen('online');
  }, []);

  useEffect(() => {
    const code = getJoinCodeFromURL();
    if (code) {
      // Save to localStorage so it survives login/page reload
      localStorage.setItem('stone_pending_join', code);
      setAutoJoinCode(code);
      setScreen('online');
      window.history.replaceState({}, '', '/');
    } else if (player) {
      // Only check pending join if player is already logged in
      const pending = localStorage.getItem('stone_pending_join');
      if (pending) {
        localStorage.removeItem('stone_pending_join');
        setAutoJoinCode(pending);
        setScreen('online');
      }
    }
  }, [player]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#302b26' }}>
        <img src="/logo.png" alt="STONE" className="h-28 sm:h-36 object-contain animate-pulse" />
        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <PlayerContext.Provider value={playerHook}>
      {/* Username prompt for first-time visitors */}
      {!player && <UsernamePrompt />}

      {screen === 'terms' && <TermsPage onBack={() => setScreen('game')} />}
      {screen === 'privacy' && <PrivacyPage onBack={() => setScreen('game')} />}
      {screen === 'feedback' && <FeedbackPanel onBack={() => setScreen('game')} />}
      {screen === 'tutorial' && <Tutorial onFinish={() => setScreen('game')} />}
      {screen === 'colors' && (
        <ColorPicker
          selectedId={stoneColor}
          onSelect={(id) => { setStoneColor(id); savePlayerColor(id); }}
          onBack={() => setScreen('game')}
        />
      )}
      {screen === 'stats' && <PlayerStats onBack={() => setScreen('game')} onInviteToPlay={handleInviteToPlay} />}
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
      {screen === 'friends' && (
        <FriendsList
          onBack={() => setScreen('game')}
          onInviteToPlay={handleInviteToPlay}
        />
      )}
      {screen === 'online' && (
        <OnlineGame
          onBack={() => { setScreen('game'); setAutoJoinCode(null); setResumeData(null); setResumeLocalGameId(null); }}
          autoJoinCode={autoJoinCode}
          resumeData={resumeData}
        />
      )}
      {screen === 'game' && (
        <Game
          onPlayOnline={() => { setResumeLocalGameId(null); setScreen('online'); }}
          onShowStats={() => setScreen('stats')}
          onShowLeaderboard={() => setScreen('leaderboard')}
          onShowMyGames={() => { setResumeLocalGameId(null); setScreen('my-games'); }}
          onShowColors={() => setScreen('colors')}
          onShowFriends={() => setScreen('friends')}
          pendingNotifications={pendingNotifications}
          resumeGameId={resumeLocalGameId}
          onShowTerms={() => setScreen('terms')}
          onShowPrivacy={() => setScreen('privacy')}
          onShowFeedback={() => setScreen('feedback')}
          onShowTutorial={() => setScreen('tutorial')}
        />
      )}

      {/* Notifications overlay - always rendered */}
      <Notifications onAcceptInvite={handleAcceptNotificationInvite} />
    </PlayerContext.Provider>
    </ErrorBoundary>
  );
}
