import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
interface FeedbackRow {
  id: string;
  username: string | null;
  type: string;
  message: string;
  created_at: string;
}

export default function AdminFeedback({ onBack }: { onBack: () => void }) {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('feedback')
        .select('id, username, type, message, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setFeedback(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from('feedback').delete().eq('id', id);
    setFeedback(prev => prev.filter(f => f.id !== id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const typeColors: Record<string, string> = {
    bug: 'text-red-400 bg-red-900/30',
    feature: 'text-sky-400 bg-sky-900/30',
    other: 'text-white/60 bg-white/10',
  };

  return (
    <div className="h-screen flex flex-col items-center py-6 px-4 overflow-y-auto">
      <img src="/logo.png" alt="STONE" className="h-20 sm:h-28 object-contain cursor-pointer mb-4" onClick={onBack} />

      <div className="flex flex-col gap-4 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-4 sm:p-6 shadow-lg max-w-2xl w-full">
        <div className="flex items-center justify-between">
          <p className="text-white font-heading text-lg">Feedback ({feedback.length})</p>
          <button onClick={onBack}
            className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer">
            Back
          </button>
        </div>

        {loading ? (
          <p className="text-white/40 text-sm">Loading...</p>
        ) : feedback.length === 0 ? (
          <p className="text-white/40 text-sm">No feedback yet</p>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {feedback.map(f => (
              <div key={f.id} className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-heading uppercase tracking-wider px-2 py-0.5 rounded ${typeColors[f.type] || typeColors.other}`}>
                      {f.type}
                    </span>
                    <span className="text-white text-xs font-heading">{f.username || 'Anonymous'}</span>
                    <span className="text-white/30 text-[9px]">{timeAgo(f.created_at)}</span>
                  </div>
                  <button onClick={() => handleDelete(f.id)}
                    className="text-red-400/40 hover:text-red-400 text-[9px] cursor-pointer transition-colors">
                    Delete
                  </button>
                </div>
                <p className="text-white/80 text-sm whitespace-pre-wrap">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
