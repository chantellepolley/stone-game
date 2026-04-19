import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayerContext } from '../contexts/PlayerContext';

export default function FeedbackPanel({ onBack }: { onBack: () => void }) {
  const { player } = usePlayerContext();
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    await supabase.from('feedback').insert({
      player_id: player?.id || null,
      username: player?.username || 'Anonymous',
      type,
      message: message.trim(),
    });
    setSubmitting(false);
    setSubmitted(true);
    setMessage('');
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 px-4">
      <img src="/logo.png" alt="STONE" className="h-24 sm:h-32 lg:h-40 object-contain cursor-pointer" onClick={onBack} />

      <div className="flex flex-col items-center gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-md w-full">
        <p className="text-white font-heading text-lg">Send Feedback</p>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-3xl">&#10003;</div>
            <p className="text-green-400 font-heading text-sm">Thanks for your feedback!</p>
            <p className="text-white/50 text-xs text-center">We'll review it and use it to improve the game.</p>
            <button onClick={() => setSubmitted(false)}
              className="text-amber-400/70 text-xs hover:text-amber-400 cursor-pointer transition-colors mt-2">
              Send another
            </button>
          </div>
        ) : (
          <>
            {/* Type selector */}
            <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 w-full">
              {([
                { value: 'bug' as const, label: 'Bug / Glitch' },
                { value: 'feature' as const, label: 'Feature Idea' },
                { value: 'other' as const, label: 'Other' },
              ]).map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-heading uppercase tracking-wider transition-colors cursor-pointer
                    ${type === t.value ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white/70'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={type === 'bug'
                ? 'Describe the glitch — what happened and what you expected...'
                : type === 'feature'
                ? 'What feature would you like to see?'
                : 'Tell us anything...'}
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-lg bg-black/30 border-2 border-[#6b5f55] text-white text-sm
                         placeholder:text-white/30
                         focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />

            <div className="flex items-center justify-between w-full">
              <span className="text-white/30 text-[9px]">{message.length}/1000</span>
              <span className="text-white/30 text-[9px]">Sending as {player?.username || 'Anonymous'}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="w-full px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-amber-600 text-white border-2 border-amber-500
                         hover:bg-amber-500 hover:scale-105 active:scale-95
                         transition-all cursor-pointer shadow-lg
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitting ? 'Sending...' : 'Submit Feedback'}
            </button>
          </>
        )}

        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-1">
          Back
        </button>
      </div>
    </div>
  );
}
