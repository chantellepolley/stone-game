import { useState } from 'react';
import { usePlayerContext } from '../contexts/PlayerContext';

export default function UsernamePrompt() {
  const { createPlayer, login } = usePlayerContext();
  const [mode, setMode] = useState<'choose' | 'create' | 'login'>('choose');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [referralInput, setReferralInput] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 15) { setError('Name must be 15 characters or less'); return; }
    if (!password) { setError('Password is required'); return; }
    if (password.length < 3) { setError('Password must be at least 3 characters'); return; }

    setSubmitting(true);
    setError('');
    // Store referral code before creating (usePlayer reads it from localStorage)
    if (referralInput.trim()) {
      localStorage.setItem('stone_referral_code', referralInput.trim().toUpperCase());
    }
    const result = await createPlayer(trimmed, password);
    if (result !== true) {
      setError(result);
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

      {mode === 'choose' ? (
        /* ── Initial choice: two big buttons ── */
        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-white text-sm font-heading">Welcome to Stone</p>

          <button
            onClick={() => { setMode('login'); setError(''); }}
            className="w-full px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-amber-600 text-white border-2 border-amber-500
                       hover:bg-amber-500 hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg"
          >
            Login
          </button>

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/40 text-xs">OR</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <button
            onClick={() => { setMode('create'); setError(''); }}
            className="w-full px-6 py-4 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-[#5e5549] text-white border-2 border-[#6b5f55]
                       hover:bg-[#6b5f55] hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg"
          >
            Create Account
          </button>
        </div>
      ) : (
        /* ── Login or Create form ── */
        <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
          <p className="text-white text-sm font-heading">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
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
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                       text-center text-lg font-heading
                       placeholder:text-white/30 placeholder:text-sm
                       focus:outline-none focus:border-amber-400 transition-colors"
          />

          {mode === 'create' && (
            <input
              type="text"
              value={referralInput}
              onChange={e => setReferralInput(e.target.value)}
              placeholder="Referral code (optional)"
              maxLength={15}
              className="w-full px-4 py-2 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                         text-center text-sm font-heading
                         placeholder:text-white/20 placeholder:text-xs
                         focus:outline-none focus:border-amber-400 transition-colors"
            />
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            onClick={mode === 'create' ? handleCreate : handleLogin}
            disabled={submitting || name.trim().length < 2}
            className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                       bg-amber-600 text-white border-2 border-amber-500
                       hover:bg-amber-500 hover:scale-105 active:scale-95
                       transition-all cursor-pointer shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? '...' : mode === 'create' ? 'Create Account' : 'Login'}
          </button>

          <button
            onClick={() => { setMode('choose'); setError(''); setName(''); setPassword(''); }}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer"
          >
            Back
          </button>

          {mode === 'login' && (
            <p className="text-white/30 text-[10px] text-center">
              Don't have an account? <button onClick={() => { setMode('create'); setError(''); }} className="text-amber-400/70 hover:text-amber-400 cursor-pointer">Create one</button>
            </p>
          )}
          {mode === 'create' && (
            <p className="text-white/30 text-[10px] text-center">
              Already have an account? <button onClick={() => { setMode('login'); setError(''); }} className="text-amber-400/70 hover:text-amber-400 cursor-pointer">Login</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
