import { useState, useRef, useEffect } from 'react';
import type { GameMode, AIDifficulty } from '../types/game';
import { usePlayerContext } from '../contexts/PlayerContext';

interface StartScreenProps {
  onStart: (mode: GameMode, difficulty: AIDifficulty) => void;
  onPlayOnline?: () => void;
  onShowStats?: () => void;
  onShowLeaderboard?: () => void;
  onShowMyGames?: () => void;
  onShowColors?: () => void;
}

export default function StartScreen({ onStart, onPlayOnline, onShowStats, onShowLeaderboard, onShowMyGames, onShowColors }: StartScreenProps) {
  const { player, updateUsername, updateAvatar } = usePlayerContext();
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    setUploadingAvatar(true);
    await updateAvatar(file);
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    <div className="h-screen flex flex-col items-center justify-center gap-6 sm:gap-8 px-4">
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

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
            <p className="text-white/50 text-sm font-heading">Welcome back, <span className="text-amber-400">{player.username}</span></p>
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
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/60 text-sm font-heading tracking-wider">Choose how to play</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => onStart('pvp', 'medium')}
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-[#504840] text-white border-2 border-[#6b5f55]
                         hover:bg-[#5e5549] hover:scale-105 active:scale-95
                         transition-all cursor-pointer shadow-lg"
            >
              2 Players
            </button>
            <button
              onClick={() => setShowDifficulty(true)}
              className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-[#504840] text-white border-2 border-[#6b5f55]
                         hover:bg-[#5e5549] hover:scale-105 active:scale-95
                         transition-all cursor-pointer shadow-lg"
            >
              vs Computer
            </button>
            {onPlayOnline && (
              <button
                onClick={onPlayOnline}
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-amber-600/60
                           hover:bg-[#5e5549] hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-lg"
              >
                Play Online
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-white/60 text-sm font-heading tracking-wider">Select difficulty</p>
          <div className="flex gap-3">
            {([
              { level: 'easy' as AIDifficulty, label: 'Easy', desc: 'Random moves' },
              { level: 'medium' as AIDifficulty, label: 'Medium', desc: 'Smart strategy' },
              { level: 'hard' as AIDifficulty, label: 'Hard', desc: 'Looks ahead' },
            ]).map(({ level, label, desc }) => (
              <button
                key={level}
                onClick={() => onStart('ai', level)}
                className="px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                           bg-[#504840] text-white border-2 border-[#6b5f55]
                           hover:bg-[#5e5549] hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-lg flex flex-col items-center gap-1"
              >
                <span>{label}</span>
                <span className="text-[10px] text-white/40 normal-case">{desc}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowDifficulty(false)}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-2"
          >
            Back
          </button>
        </div>
      )}

      {/* Stats, Leaderboard & My Games */}
      {!showDifficulty && (
        <div className="flex gap-3 flex-wrap justify-center">
          {onShowMyGames && (
            <button onClick={onShowMyGames}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              My Games
            </button>
          )}
          {onShowStats && (
            <button onClick={onShowStats}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              My Stats
            </button>
          )}
          {onShowLeaderboard && (
            <button onClick={onShowLeaderboard}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              Leaderboard
            </button>
          )}
          {onShowColors && (
            <button onClick={onShowColors}
              className="px-4 py-2 rounded-lg text-xs font-heading uppercase tracking-wider
                         text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              Stone Color
            </button>
          )}
        </div>
      )}
    </div>
  );
}
