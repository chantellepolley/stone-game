import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isMine: boolean;
  avatarUrl?: string | null;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  unreadCount?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export default function ChatPanel({ messages, onSend, isOpen = true, onToggle, unreadCount = 0 }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="relative px-2 py-1 rounded-lg text-[9px] font-heading uppercase tracking-wider
                   bg-[#504840] text-white border border-[#6b5f55] cursor-pointer shadow-md whitespace-nowrap"
      >
        Chat
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col bg-[#3d3632] border-2 border-[#5e5549] rounded-xl shadow-lg overflow-hidden
                    w-[200px] max-h-[300px] lg:max-h-[350px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#504840] border-b border-[#5e5549]">
        <span className="text-[10px] font-heading uppercase tracking-wider text-white/70">Chat</span>
        {onToggle && (
          <button onClick={onToggle} className="text-white/40 hover:text-white/70 text-xs cursor-pointer transition-colors">
            x
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 min-h-[80px] max-h-[220px]">
        {messages.length === 0 && (
          <p className="text-white/20 text-[10px] text-center italic mt-4">No messages yet</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-1.5 ${msg.isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.avatarUrl ? (
              <img src={msg.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 mt-2" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#3d3632] flex items-center justify-center shrink-0 mt-2">
                <span className="text-[7px] text-white/40 font-heading">{(msg.sender || '?')[0].toUpperCase()}</span>
              </div>
            )}
            <div className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-center gap-1 ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                <span className="text-[8px] text-white/30">{msg.sender}</span>
                <span className="text-[7px] text-white/20">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`px-2 py-1 rounded-lg text-[11px] max-w-[150px] break-words
                ${msg.isMine
                  ? 'bg-amber-600/30 text-white/90'
                  : 'bg-white/10 text-white/80'
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-1 px-1.5 py-1.5 border-t border-[#5e5549]">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type..."
          maxLength={200}
          className="flex-1 px-2 py-1 rounded bg-black/30 border border-[#5e5549] text-white text-[11px]
                     placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 transition-colors min-w-0"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-2 py-1 rounded bg-amber-600/60 text-white text-[10px] font-heading uppercase
                     hover:bg-amber-600/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
