import { useState } from 'react';

interface UsernamePromptProps {
  onSubmit: (username: string) => Promise<boolean>;
}

export default function UsernamePrompt({ onSubmit }: UsernamePromptProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }
    if (trimmed.length > 15) { setError('Name must be 15 characters or less'); return; }

    setSubmitting(true);
    setError('');
    const success = await onSubmit(trimmed);
    if (!success) {
      setError('Could not create account. Try a different name.');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-4 z-50"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <img src="/logo.png" alt="STONE" className="h-32 sm:h-40 lg:h-48 object-contain" />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full">
        <p className="text-white text-sm font-heading">Choose your name</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter a username"
          maxLength={15}
          autoFocus
          className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white
                     text-center text-lg font-heading
                     placeholder:text-white/30 placeholder:text-sm
                     focus:outline-none focus:border-amber-400 transition-colors"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting || name.trim().length < 2}
          className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                     bg-amber-600 text-white border-2 border-amber-500
                     hover:bg-amber-500 hover:scale-105 active:scale-95
                     transition-all cursor-pointer shadow-lg
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {submitting ? 'Creating...' : "Let's Play"}
        </button>
      </div>
    </div>
  );
}
