import { useState } from 'react';
import { usePlayerContext } from '../contexts/PlayerContext';

export default function UsernamePrompt() {
  const { createPlayer, login } = usePlayerContext();
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 15) { setError('Name must be 15 characters or less'); return; }

    setSubmitting(true);
    setError('');
    const success = await createPlayer(trimmed, password || undefined);
    if (!success) {
      setError('Could not create account. Try a different name.');
    }
    setSubmitting(false);
  };

  const handleLogin = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter your username'); return; }
    if (!password) { setError('Enter your password'); return; }

    setSubmitting(true);
    setError('');
    const result = await login(trimmed, password);
    if (result !== true) {
      setError(result);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-4 z-50"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
        {/* Tab toggle */}
        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-full">
          <button
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md text-xs font-heading uppercase tracking-wider transition-colors cursor-pointer
              ${mode === 'create' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}
          >
            New Player
          </button>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 rounded-md text-xs font-heading uppercase tracking-wider transition-colors cursor-pointer
              ${mode === 'login' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}
          >
            Login
          </button>
        </div>

        <p className="text-white text-sm font-heading">
          {mode === 'create' ? 'Choose your name' : 'Welcome back'}
        </p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Username"
          maxLength={15}
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                     text-center text-lg font-heading
                     placeholder:text-white/30 placeholder:text-sm
                     focus:outline-none focus:border-amber-400 transition-colors"
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleLogin())}
          placeholder={mode === 'create' ? 'Password (optional)' : 'Password'}
          className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                     text-center text-lg font-heading
                     placeholder:text-white/30 placeholder:text-sm
                     focus:outline-none focus:border-amber-400 transition-colors"
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={mode === 'create' ? handleCreate : handleLogin}
          disabled={submitting || name.trim().length < 2}
          className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                     bg-amber-600 text-white border-2 border-amber-500
                     hover:bg-amber-500 hover:scale-105 active:scale-95
                     transition-all cursor-pointer shadow-lg
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {submitting ? '...' : mode === 'create' ? "Let's Play" : 'Login'}
        </button>
      </div>
    </div>
  );
}
