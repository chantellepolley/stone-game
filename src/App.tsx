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
import AdminFeedback from './components/AdminFeedback';
import AdminPlayers from './components/AdminPlayers';
import MonthlyStandings from './components/MonthlyStandings';
import HallOfFame from './components/HallOfFame';
import Challenges from './components/Challenges';
import { usePushNotifications } from './hooks/usePushNotifications';
import { loadPlayerColor, savePlayerColor, syncColorFromDb } from './utils/stoneColors';
import { usePlayer } from './hooks/usePlayer';
import { PlayerContext } from './contexts/PlayerContext';
import { CoinsProvider } from './contexts/CoinsContext';
import { supabase } from './lib/supabase';
import { createInitialState } from './engine';

type AppScreen = 'game' | 'online' | 'stats' | 'leaderboard' | 'my-games' | 'colors' | 'friends' | 'terms' | 'privacy' | 'feedback' | 'tutorial' | 'admin-feedback' | 'admin-players' | 'monthly-standings' | 'hall-of-fame' | 'challenges';

function getJoinCodeFromURL(): string | null {
  const path = window.location.pathname;
  const joinMatch = path.match(/\/join\/([A-Za-z0-9]+)/);
  if (joinMatch) return joinMatch[1].toUpperCase();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('join');
  if (code) return code.toUpperCase();
  return null;
}

// Capture referral code from URL (?ref=CODE) and save to localStorage
function captureReferralCode(): void {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('stone_referral_code', ref.toUpperCase());
    // Clean the URL
    params.delete('ref');
    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }
}
captureReferralCode();

export default function App() {
  const playerHook = usePlayer();
  const { player, isLoading } = playerHook;
  const { supported: pushSupported, permission: pushPermission, requestPermission, unsubscribe, subscribe } = usePushNotifications();
  const [screen, setScreen] = useState<AppScreen>('game');
  const [pushMuted, setPushMuted] = useState(() => localStorage.getItem('stone_push_muted') === '1');

  // Ask for notification permission once player is logged in
  useEffect(() => {
    if (player && pushSupported && pushPermission === 'default') {
      // Delay the prompt so it doesn't interrupt the initial experience
      const timer = setTimeout(() => requestPermission(), 5000);
      return () => clearTimeout(timer);
    }
  }, [player, pushSupported, pushPermission, requestPermission]);
  const [autoJoinCode, setAutoJoinCode] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<{ gameId: string; roomCode: string; player: 1 | 2; inviteId?: string } | null>(null);
  const [resumeLocalGameId, setResumeLocalGameId] = useState<string | null>(null);
  const [stoneColor, setStoneColor] = useState(loadPlayerColor());
  const [pendingNotifications, setPendingNotifications] = useState(0);

  // Sync color and owned colors from DB on login
  useEffect(() => {
    if (player) {
      syncColorFromDb(player.id).then(() => {
        setStoneColor(loadPlayerColor());
      });
      // Check if previous month's POTM winner needs to be crowned
      import('./lib/monthlyPoints').then(({ checkAndCrownWinner }) => {
        checkAndCrownWinner().catch(() => {});
      });
    }
  }, [player]);

  // Poll for pending notifications (invites + your-turn games)
  const pollNotifications = useCallback(async () => {
    if (!player) return;
    let count = 0;

    // Count pending game invites
    const { count: inviteCount } = await supabase
      .from('game_invites')
      .select('id', { count: 'exact', head: true })
      .eq('to_player_id', player.id)
      .eq('status', 'pending');
    count += (inviteCount || 0);

    // Count online games where it's my turn (exclude AI, local, and waiting-for-opponent)
    const { data: activeGames } = await supabase
      .from('games')
      .select('id, state, player1_id, player2_id, mode')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .eq('status', 'active')
      .eq('mode', 'online')
      .limit(20);

    if (activeGames) {
      for (const g of activeGames) {
        // Skip games still waiting for an opponent
        if (!g.player2_id) continue;
        const myP = g.player1_id === player.id ? 1 : 2;
        const state = g.state as any;
        if (!state) continue;
        // Only count if game is in a playable phase and it's my turn
        const phase = state.phase;
        if (phase === 'game_over' || phase === 'not_started') continue;
        if (state.currentPlayer === myP) count++;
      }
    }

    setPendingNotifications(count);

    // Update app icon badge (PWA home screen)
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [player]);

  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);

    // Realtime subscription for instant badge updates
    if (!player) return () => clearInterval(interval);
    const channel = supabase
      .channel('badge-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `player1_id=eq.${player.id}`,
      }, () => pollNotifications())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `player2_id=eq.${player.id}`,
      }, () => pollNotifications())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_invites',
        filter: `to_player_id=eq.${player.id}`,
      }, () => pollNotifications())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pollNotifications, player]);

  const handleTogglePushMute = useCallback(async () => {
    if (pushMuted) {
      // Unmute — re-subscribe
      localStorage.removeItem('stone_push_muted');
      setPushMuted(false);
      await subscribe();
    } else {
      // Mute — unsubscribe from push
      localStorage.setItem('stone_push_muted', '1');
      setPushMuted(true);
      await unsubscribe();
    }
  }, [pushMuted, subscribe, unsubscribe]);

  const handleInviteToPlay = useCallback(async (toPlayerId: string, wager = 0) => {
    if (!player) return;

    // Generate room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];

    // Create the game — player 2 (invitee) rolls first so it's async-friendly
    const initialState = { ...createInitialState(), phase: 'rolling', gameMode: 'pvp', currentPlayer: 2 as const };
    const { data: game, error: gameErr } = await supabase.from('games').insert({
      room_code: code,
      player1_id: player.id,
      mode: 'online',
      state: initialState,
      status: 'waiting',
      wager,
      p1_color: loadPlayerColor(),
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
      alert(wager > 0 ? `Game invite sent! (${wager} coin wager)` : 'Game invite sent! They will roll first.');
    }
  }, [player]);

  const handleAcceptNotificationInvite = useCallback((gameId: string, roomCode: string, inviteId?: string) => {
    setResumeData({ gameId, roomCode, player: 2, inviteId });
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
    <CoinsProvider>
      {/* Username prompt for first-time visitors */}
      {!player && <UsernamePrompt />}

      {screen === 'terms' && <TermsPage onBack={() => setScreen('game')} />}
      {screen === 'privacy' && <PrivacyPage onBack={() => setScreen('game')} />}
      {screen === 'feedback' && <FeedbackPanel onBack={() => setScreen('game')} />}
      {screen === 'tutorial' && <Tutorial onFinish={() => setScreen('game')} />}
      {screen === 'admin-feedback' && <AdminFeedback onBack={() => setScreen('game')} />}
      {screen === 'admin-players' && <AdminPlayers onBack={() => setScreen('game')} />}
      {screen === 'monthly-standings' && <MonthlyStandings onBack={() => setScreen('game')} onShowHallOfFame={() => setScreen('hall-of-fame')} />}
      {screen === 'hall-of-fame' && <HallOfFame onBack={() => setScreen('monthly-standings')} />}
      {screen === 'challenges' && <Challenges onBack={() => setScreen('game')} />}
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
          onInviteFriend={handleInviteToPlay}
          onResumeLocalGame={(gameId) => { setResumeLocalGameId(gameId); setScreen('game'); }}
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
          onShowAdminFeedback={() => setScreen('admin-feedback')}
          onShowAdminPlayers={() => setScreen('admin-players')}
          onShowMonthlyStandings={() => setScreen('monthly-standings')}
          onShowChallenges={() => setScreen('challenges')}
          pushPermission={pushPermission}
          onRequestPush={requestPermission}
          pushMuted={pushMuted}
          onTogglePushMute={handleTogglePushMute}
          onResumeOnlineGame={(gameId, roomCode, p) => { setResumeData({ gameId, roomCode, player: p }); setScreen('online'); }}
          onClearResumeId={() => setResumeLocalGameId(null)}
        />
      )}

      {/* Notifications overlay - always rendered */}
      <Notifications onAcceptInvite={handleAcceptNotificationInvite} />
    </CoinsProvider>
    </PlayerContext.Provider>
    </ErrorBoundary>
  );
}
