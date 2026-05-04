import { useState, useRef, useEffect } from 'react';
import type { GameMode, AIDifficulty } from '../types/game';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { AI_WAGER } from '../lib/coins';

import { supabase } from '../lib/supabase';
import JesterCoin from './JesterCoin';

interface StartScreenProps {
  onStart: (mode: GameMode, difficulty: AIDifficulty, wager?: number) => void;
  onPlayOnline?: () => void;
  onShowStats?: () => void;
  onShowLeaderboard?: () => void;
  onShowMyGames?: () => void;
  onShowColors?: () => void;
  onShowFriends?: () => void;
  pendingNotifications?: number;
  onShowTerms?: () => void;
  onShowPrivacy?: () => void;
  onShowFeedback?: () => void;
  onShowTutorial?: () => void;
  onShowAdminFeedback?: () => void;
  onShowAdminPlayers?: () => void;
  onShowMonthlyStandings?: () => void;
  pushPermission?: NotificationPermission;
  onRequestPush?: () => void;
  pushMuted?: boolean;
  onTogglePushMute?: () => void;
}

export default function StartScreen({ onStart, onPlayOnline, onShowStats, onShowLeaderboard, onShowMyGames, onShowColors, onShowFriends, pendingNotifications, onShowTerms, onShowPrivacy, onShowFeedback, onShowTutorial, onShowAdminFeedback, onShowAdminPlayers, onShowMonthlyStandings, pushPermission, onRequestPush, pushMuted, onTogglePushMute }: StartScreenProps) {
  const { player, updateUsername, updateAvatar, logout, updatePassword } = usePlayerContext();
  const { coins, dailyBonusClaimed, dailyBonusAmount, dailyStreak, dismissDailyBonus } = useCoins();
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [aiWagerEnabled, setAiWagerEnabled] = useState(true);
  const [showCoinRules, setShowCoinRules] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(() => {
    // Only show for cpolley for now (admin preview)
    const seen = localStorage.getItem('stone_seen_announcement_potm');
    if (seen) return false;
    return true;
  });
  const [showReferralAnnouncement, setShowReferralAnnouncement] = useState(() => {
    const seen = localStorage.getItem('stone_seen_announcement_referral');
    if (seen) return false;
    return true;
  });
  const [showReferralPanel, setShowReferralPanel] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'newgame' | 'challenges' | 'settings'>(() => {
    const saved = localStorage.getItem('stone_menu_view');
    if (saved === 'newgame' || saved === 'challenges' || saved === 'settings') {
      localStorage.removeItem('stone_menu_view');
      return saved;
    }
    return 'main';
  });
  const [potmCountdown, setPotmCountdown] = useState('');
  const [bonusCountdown, setBonusCountdown] = useState('');

  // Countdown to next daily bonus (midnight local time)
  useEffect(() => {
    if (dailyBonusClaimed || !coins) return; // still available or no coins loaded
    // Already claimed today — show countdown to tomorrow
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setBonusCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [dailyBonusClaimed, coins]);

  // POTM countdown
  useEffect(() => {
    if (!showAnnouncement) return;
    const POTM_START = Date.UTC(2026, 4, 1, 0, 0, 0);
    const tick = () => {
      const ms = Math.max(0, POTM_START - Date.now());
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      if (days > 0) {
        setPotmCountdown(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else {
        setPotmCountdown(`${hours}h ${mins}m ${secs}s`);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [showAnnouncement]);

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  // Poll for unread feedback (admin only)
  useEffect(() => {
    if (player?.username?.toLowerCase() !== 'cpolley') return;
    const lastSeen = localStorage.getItem('stone_feedback_last_seen') || '2000-01-01';
    const check = async () => {
      const { count } = await supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', lastSeen);
      setPendingFeedbackCount(count || 0);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [player]);
  const { canInstall, isInstalled, install, showIOSInstructions, bannerDismissed, dismissBanner } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  // Load referral code
  useEffect(() => {
    if (!player) return;
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('players').select('referral_code').eq('id', player.id).single()
        .then(({ data }) => { if (data?.referral_code) setReferralCode(data.referral_code); });
    });
  }, [player]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    setUploadingAvatar(true);
    await updateAvatar(file);
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 3) { setPasswordMsg('Password must be at least 3 characters'); return; }
    setSavingPassword(true);
    const ok = await updatePassword(newPassword);
    setSavingPassword(false);
    if (ok) { setPasswordMsg('Password saved!'); setNewPassword(''); setTimeout(() => { setEditingPassword(false); setPasswordMsg(''); }, 1500); }
    else setPasswordMsg('Failed to save');
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2) return;
    setSavingName(true);
    const ok = await updateUsername(trimmed);
    setSavingName(false);
    if (ok) setEditingName(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 py-2">
      {/* Install banner for first-time visitors */}
      {!isInstalled && !bannerDismissed && (canInstall || showIOSInstructions) && (
        <div className="fixed top-0 left-0 right-0 bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-3 z-50 shadow-lg">
          <span className="text-xs font-heading">Install STONE on your device for the best experience!</span>
          {canInstall && (
            <button onClick={install}
              className="px-3 py-1 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-white text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors">
              Install
            </button>
          )}
          {showIOSInstructions && (
            <button onClick={() => setShowIOSModal(true)}
              className="px-3 py-1 rounded-lg text-[10px] font-heading uppercase tracking-wider
                         bg-white text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors">
              How
            </button>
          )}
          <button onClick={dismissBanner}
            className="text-white/70 hover:text-white text-sm cursor-pointer ml-1">
            ×
          </button>
        </div>
      )}

      {/* iOS install instructions modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-white font-heading text-lg mb-3">Add to Home Screen</h2>
            <div className="text-white/70 text-sm space-y-2 text-left">
              <p>1. Tap the <strong>Share</strong> button <span className="text-lg">&#8593;</span> at the bottom of Safari</p>
              <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              <p>3. Tap <strong>"Add"</strong></p>
            </div>
            <p className="text-white/50 text-xs mt-3">STONE will appear as an app on your home screen!</p>
            <button onClick={() => setShowIOSModal(false)}
              className="mt-4 px-6 py-2 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-amber-600 text-white hover:bg-amber-500 cursor-pointer shadow-lg">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* POTM Announcement */}
      {showAnnouncement && player && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-amber-600/40 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
            <p className="text-3xl mb-2">&#127942;</p>
            <h2 className="text-amber-400 font-heading text-xl mb-1">Player of the Month</h2>
            <p className="text-white/70 text-sm mb-4">
              The competition is here! Compete for the title of STONE's top player each month.
              Win games, build streaks, and earn points. The winner gets an exclusive champion stone
              and 500 coins!
            </p>

            {/* Champion stone preview */}
            <div className="flex justify-center mb-3">
              <img src="/champion-2026-05.png" alt="May Champion Stone" className="w-20 h-20 object-contain" />
            </div>

            {/* Countdown */}
            <div className="bg-black/20 rounded-lg px-4 py-2 mb-4">
              <p className="text-[9px] text-white/40 uppercase tracking-wider font-heading">Competition begins</p>
              <p className="text-white font-heading text-lg">{potmCountdown}</p>
              <p className="text-[9px] text-white/30">May 1, 2026 at 12:00 AM UTC</p>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => {
                localStorage.setItem('stone_seen_announcement_potm', '1');
                setShowAnnouncement(false);
                if (onShowMonthlyStandings) onShowMonthlyStandings();
              }}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                View Details
              </button>
              <button onClick={() => {
                localStorage.setItem('stone_seen_announcement_potm', '1');
                setShowAnnouncement(false);
              }}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily bonus toast */}
      {dailyBonusClaimed && dailyBonusAmount && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-[slideIn_0.3s_ease-out]">
          <div className="bg-[#504840] border-2 border-amber-600/60 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3">
            <JesterCoin size={32} />
            <div>
              <p className="text-amber-400 font-heading text-sm">Daily Bonus!</p>
              <p className="text-white/70 text-xs">+{dailyBonusAmount} coins added</p>
              {dailyStreak > 1 && <p className="text-amber-400/70 text-[10px]">{dailyStreak}-day streak!</p>}
            </div>
            <button onClick={dismissDailyBonus} className="text-white/40 hover:text-white/70 text-sm cursor-pointer ml-2">x</button>
          </div>
        </div>
      )}

      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain cursor-pointer" onClick={() => setShowDifficulty(false)} />

      {player && !editingName && (
        <div className="flex flex-col items-center gap-2">
          {/* Avatar */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#6b5f55] hover:border-amber-400 transition-colors cursor-pointer group"
            title="Change profile picture"
          >
            {player.avatarUrl ? (
              <img src={player.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#504840] flex items-center justify-center">
                <span className="text-2xl font-heading text-white/40">{player.username[0].toUpperCase()}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-heading">Welcome back, <span className="text-amber-400">{player.username}</span></p>
            <button
              onClick={() => { setNewName(player.username); setEditingName(true); }}
              className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              title="Edit username"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          </div>
          {coins !== null && (
            <button onClick={() => setShowCoinRules(true)}
              className="flex items-center gap-1.5 bg-black/30 px-3 py-1 rounded-full border border-amber-600/40
                         cursor-pointer transition-all hover:scale-105 hover:border-amber-400
                         shadow-[0_0_8px_rgba(255,191,0,0.25)] hover:shadow-[0_0_14px_rgba(255,191,0,0.4)]">
              <JesterCoin size={18} />
              <span className="text-amber-400 font-heading text-sm">{coins}</span>
            </button>
          )}
          {coins !== null && !dailyBonusClaimed && bonusCountdown && (
            <p className="text-white text-[9px]">Next bonus in {bonusCountdown}</p>
          )}
        </div>
      )}
      {player && editingName && (
        <div className="flex items-center gap-2">
          <input
            ref={nameInputRef}
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
            maxLength={20}
            className="px-3 py-1.5 rounded-lg bg-black/30 border border-[#6b5f55] text-white text-sm font-heading
                       focus:outline-none focus:border-amber-400 transition-colors w-40"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || newName.trim().length < 2}
            className="px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-amber-600 text-white hover:bg-amber-500 cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {savingName ? '...' : 'Save'}
          </button>
          <button
            onClick={() => setEditingName(false)}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {!showDifficulty ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          {menuView === 'main' && (
            <>
              <button onClick={() => setMenuView('newgame')}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                Start New Game
              </button>
              <button onClick={() => { if (onShowMyGames) onShowMyGames(); }}
                className="relative w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                My Games
                {(pendingNotifications ?? 0) > 0 && (
                  <span className="absolute top-2 right-3 bg-red-500 text-white text-[8px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingNotifications! > 9 ? '9+' : pendingNotifications}
                  </span>
                )}
              </button>
              <button onClick={() => setMenuView('challenges')}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                Challenges
              </button>
              <button onClick={() => setMenuView('settings')}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                Settings
              </button>
              {referralCode && (
                <button onClick={() => setShowReferralPanel(true)}
                  className="w-full px-5 py-2.5 rounded-xl font-heading text-sm uppercase tracking-wider
                             text-white hover:text-amber-200 transition-colors cursor-pointer
                             border-2 border-amber-500 bg-amber-600 shadow-lg">
                  Refer a Friend <span className="text-[10px] normal-case text-amber-200">+100 coins each</span>
                </button>
              )}
            </>
          )}

          {menuView === 'newgame' && (
            <>
              <button onClick={() => onStart('pvp', 'medium')}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                2 Players <span className="text-[10px] text-white/40 normal-case">(pass & play)</span>
              </button>
              <button onClick={() => setShowDifficulty(true)}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                vs Computer
              </button>
              {onPlayOnline && (
                <button onClick={onPlayOnline}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-amber-600/60
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Play Online <span className="text-[10px] text-white/40 normal-case">(Challenge Friends)</span>
                </button>
              )}
              <button onClick={() => setMenuView('main')}
                className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-1">
                Back
              </button>
            </>
          )}

          {menuView === 'challenges' && (
            <>
              {onShowMonthlyStandings && (
                <button onClick={onShowMonthlyStandings}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-amber-400 border-2 border-amber-600/40
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Player of the Month
                </button>
              )}
              {onShowLeaderboard && (
                <button onClick={onShowLeaderboard}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Leaderboard
                </button>
              )}
              <button onClick={() => setMenuView('main')}
                className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-1">
                Back
              </button>
            </>
          )}

          {menuView === 'settings' && (
            <>
              {onShowFriends && (
                <button onClick={onShowFriends}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  My Friends
                </button>
              )}
              {onShowStats && (
                <button onClick={onShowStats}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  My Stats
                </button>
              )}
              {onShowColors && (
                <button onClick={onShowColors}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Stone Color
                </button>
              )}
              {onShowTutorial && (
                <button onClick={onShowTutorial}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  How to Play
                </button>
              )}
              {onShowFeedback && (
                <button onClick={() => {
                  if (player?.username?.toLowerCase() === 'cpolley' && onShowAdminFeedback) {
                    localStorage.setItem('stone_feedback_last_seen', new Date().toISOString());
                    setPendingFeedbackCount(0);
                    onShowAdminFeedback();
                  } else {
                    onShowFeedback();
                  }
                }}
                  className="relative w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Feedback
                  {pendingFeedbackCount > 0 && (
                    <span className="absolute top-2 right-3 bg-red-500 text-white text-[8px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingFeedbackCount > 9 ? '9+' : pendingFeedbackCount}
                    </span>
                  )}
                </button>
              )}
              <button onClick={() => { setEditingPassword(true); setNewPassword(''); setPasswordMsg(''); }}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                Set/Change Password
              </button>
              {pushPermission === 'granted' && onTogglePushMute && (
                <button onClick={onTogglePushMute}
                  className={`w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg
                             ${pushMuted ? 'text-red-400' : 'text-green-400'}`}>
                  Notifications: {pushMuted ? 'OFF' : 'ON'}
                </button>
              )}
              {pushPermission === 'denied' && (
                <p className="text-red-400/60 text-[10px] text-center">Notifications Blocked (check browser settings)</p>
              )}
              {pushPermission === 'default' && onRequestPush && (
                <button onClick={onRequestPush}
                  className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-amber-400 border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] transition-all cursor-pointer shadow-lg">
                  Enable Notifications
                </button>
              )}
              <button onClick={logout}
                className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-red-400/70 border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] hover:text-red-400 transition-all cursor-pointer shadow-lg">
                Logout
              </button>
              <button onClick={() => setMenuView('main')}
                className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-1">
                Back
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white text-sm font-heading tracking-wider">Select difficulty</p>

          {/* Free vs Wager toggle */}
          <div className="flex gap-1 bg-black/20 rounded-lg p-0.5">
            <button onClick={() => setAiWagerEnabled(false)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer
                ${!aiWagerEnabled ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
              Free Play
            </button>
            <button onClick={() => setAiWagerEnabled(true)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1
                ${aiWagerEnabled ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
              Wager <JesterCoin size={10} />
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {([
              { level: 'easy' as AIDifficulty, label: 'Easy', desc: 'Random moves' },
              { level: 'medium' as AIDifficulty, label: 'Medium', desc: 'Smart strategy' },
              { level: 'hard' as AIDifficulty, label: 'Hard', desc: 'Looks ahead' },
              { level: 'expert' as AIDifficulty, label: 'Expert', desc: 'Master tactics' },
            ]).map(({ level, label, desc }) => {
              const cost = aiWagerEnabled ? AI_WAGER[level] : 0;
              const canAfford = cost === 0 || (coins !== null && coins >= cost);
              return (
                <button
                  key={level}
                  onClick={() => canAfford ? onStart('ai', level, cost) : undefined}
                  disabled={!canAfford}
                  className="px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                             bg-[#504840] text-white border-2 border-[#6b5f55]
                             hover:bg-[#5e5549] hover:scale-105 active:scale-95
                             transition-all cursor-pointer shadow-lg flex flex-col items-center gap-1
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span>{label}</span>
                  <span className="text-[10px] text-white/40 normal-case">{desc}</span>
                  {aiWagerEnabled && (
                    <span className="text-[10px] text-amber-400/80 normal-case flex items-center gap-1 justify-center"><JesterCoin size={12} /> {cost} coins</span>
                  )}
                  {!aiWagerEnabled && (
                    <span className="text-[10px] text-white/30 normal-case">Free</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowDifficulty(false)}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
          >
            Back
          </button>
        </div>
      )}

      {/* Password editing overlay */}
      {editingPassword && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSavePassword(); if (e.key === 'Escape') { setEditingPassword(false); setPasswordMsg(''); } }}
            placeholder="New password"
            className="px-3 py-1.5 rounded-lg bg-black/30 border border-[#6b5f55] text-white text-sm font-heading
                       focus:outline-none focus:border-amber-400 transition-colors w-36"
          />
          <button onClick={handleSavePassword} disabled={savingPassword}
            className="px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider
                       bg-amber-600 text-white hover:bg-amber-500 cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {savingPassword ? '...' : 'Save'}
          </button>
          <button onClick={() => { setEditingPassword(false); setPasswordMsg(''); }}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer">
            Cancel
          </button>
        </div>
      )}
      {passwordMsg && <p className={`text-xs ${passwordMsg.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>{passwordMsg}</p>}

      {/* Footer */}
      {!showDifficulty && (
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="flex gap-3 text-[9px] text-white">
            {onShowTerms && <button onClick={onShowTerms} className="hover:text-amber-400 transition-colors cursor-pointer">Terms</button>}
            <span className="text-white/50">|</span>
            {onShowPrivacy && <button onClick={onShowPrivacy} className="hover:text-amber-400 transition-colors cursor-pointer">Privacy</button>}
            <span className="text-white/50">|</span>
            <a href="mailto:support@stonethegame.com" className="hover:text-amber-400 transition-colors">Support</a>
          </div>
          {player?.username?.toLowerCase() === 'cpolley' && onShowAdminPlayers && (
            <button onClick={onShowAdminPlayers}
              className="px-5 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         bg-[#504840] text-white border border-[#6b5f55] hover:bg-[#5e5549]
                         cursor-pointer transition-colors shadow-md">
              View Players
            </button>
          )}
          <div className="text-[8px] text-white">
            &copy; 2026 Stone The Game. All rights reserved.
          </div>
        </div>
      )}

      {/* Referral announcement popup — admin preview only */}
      {showReferralAnnouncement && player && !showAnnouncement && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-amber-600/40 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
            <p className="text-4xl mb-2">&#127873;</p>
            <h2 className="text-amber-400 font-heading text-xl mb-1">Invite Your Friends!</h2>
            <p className="text-white/70 text-sm mb-4">
              You both get <span className="text-amber-400 font-heading">100 coins</span> when they join using your referral code. Share the love and grow the STONE community!
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => {
                localStorage.setItem('stone_seen_announcement_referral', '1');
                setShowReferralAnnouncement(false);
                setShowReferralPanel(true);
              }}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                Share Now
              </button>
              <button onClick={() => {
                localStorage.setItem('stone_seen_announcement_referral', '1');
                setShowReferralAnnouncement(false);
              }}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referral panel modal */}
      {showReferralPanel && referralCode && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-amber-400 font-heading text-xl mb-1">Refer a Friend</h2>
            <p className="text-white/70 text-sm mb-4">
              You both get <span className="text-amber-400 font-heading">+100 coins</span> when they join!
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-lg p-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://stonethegame.com?ref=${referralCode}`)}`}
                  alt="Referral QR Code"
                  width={150}
                  height={150}
                  className="block"
                />
              </div>
            </div>

            {/* Referral code display */}
            <div className="bg-black/30 rounded-lg px-4 py-2 mb-4">
              <p className="text-[9px] text-white/40 uppercase tracking-wider font-heading mb-1">Your referral code</p>
              <p className="text-amber-400 font-heading text-lg tracking-wider">{referralCode}</p>
              <p className="text-[9px] text-white/30 mt-1">stonethegame.com?ref={referralCode}</p>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => {
                const text = `Join me on STONE! Use my referral code: ${referralCode}. We both get 100 coins!\nhttps://stonethegame.com?ref=${referralCode}`;
                if (navigator.share) {
                  navigator.share({ title: 'Join STONE!', text }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(text).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); });
                }
              }}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                {refCopied ? 'Copied!' : 'Share'}
              </button>
              <button onClick={() => setShowReferralPanel(false)}
                className="px-5 py-2 rounded-lg font-heading text-sm uppercase tracking-wider
                           bg-[#5e5549] text-white hover:bg-[#6b5f55] cursor-pointer transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coin rules modal */}
      {showCoinRules && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-2xl p-6 shadow-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4 justify-center">
              <JesterCoin size={28} />
              <h2 className="text-white font-heading text-lg">Coin Rules</h2>
            </div>
            <div className="text-white/70 text-xs space-y-3">
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Daily Bonus + Login Streak</p>
                <p>Open the app daily: <span className="text-amber-400">+20</span> base. Consecutive days: day 2 = <span className="text-amber-400">+25</span>, day 3+ = <span className="text-amber-400">+30</span>, day 7+ = <span className="text-amber-400">+50</span>!</p>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">vs Computer</p>
                <p>Each difficulty has a coin entry fee. Win to earn double your wager back!</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Easy: 5</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Medium: 10</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Hard: 15</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Expert: 20</span>
                </div>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Online Games</p>
                <p>The game creator sets the wager: <span className="text-white">Free, 5, 10, 25, or 50 coins</span>. Both players pay in, winner takes all!</p>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Win Bonuses</p>
                <p><span className="text-amber-400">+10</span> for 3-win streak, <span className="text-amber-400">+25</span> for 5-win streak</p>
                <p><span className="text-amber-400">+15</span> perfect game (no pieces captured by opponent)</p>
                <p><span className="text-amber-400">+10</span> speed win (under 30 turns)</p>
                <p><span className="text-amber-400">+10</span> more double jesters than opponent</p>
                <p><span className="text-amber-400">+5</span> more regular doubles than opponent</p>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Milestones</p>
                <p><span className="text-amber-400">+50</span> every 10 wins, <span className="text-amber-400">+100</span> every 25 wins</p>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Refer a Friend</p>
                <p>Share your referral code! You both get <span className="text-amber-400">+100 coins</span> when they join!</p>
              </div>
              <div>
                <p className="text-amber-400 font-heading text-[11px] uppercase tracking-wider mb-1">Forfeit</p>
                <p>You can forfeit a game at any time, but you lose your wager and your opponent wins.</p>
              </div>
            </div>
            <button onClick={() => setShowCoinRules(false)}
              className="w-full mt-5 px-4 py-2 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors shadow-lg">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
