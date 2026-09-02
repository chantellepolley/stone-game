import { useEffect, useRef, useState } from 'react';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useCoins } from '../contexts/CoinsContext';
import { loadChecklist, CHECKLIST_TASK_REWARD, CHECKLIST_COMPLETE_BONUS, type ChecklistTask } from '../lib/checklist';
import JesterCoin from './JesterCoin';

/**
 * Getting Started card for new (onboarded) players. Shows on the main menu until
 * all tasks are done and the player dismisses it. Rewards are paid idempotently
 * by loadChecklist, so this component only reflects and celebrates progress.
 */
export default function GettingStarted() {
  const { player } = usePlayerContext();
  const { refreshCoins } = useCoins();
  const [tasks, setTasks] = useState<ChecklistTask[] | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem('stone_checklist_hidden') === '1');
  const [justEarned, setJustEarned] = useState(0);
  const ran = useRef(false);

  const eligible = !!player && localStorage.getItem('stone_onboarded') === '1' && !hidden;

  useEffect(() => {
    if (!eligible || ran.current || !player) return;
    ran.current = true;
    loadChecklist(player.id).then(({ tasks, earned, allDone }) => {
      setTasks(tasks);
      setAllDone(allDone);
      if (earned > 0) { setJustEarned(earned); refreshCoins(); }
    }).catch(() => {});
  }, [eligible, player, refreshCoins]);

  if (!eligible || !tasks) return null;

  const doneCount = tasks.filter(t => t.done).length;

  const dismiss = () => { localStorage.setItem('stone_checklist_hidden', '1'); setHidden(true); };

  return (
    <div className="w-full bg-[#504840] border-2 border-amber-600/40 rounded-xl shadow-lg overflow-hidden">
      <button onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[#5e5549]/40 transition-colors">
        <span className="flex items-center gap-2">
          <span className="text-amber-400 font-heading text-sm uppercase tracking-wider">Getting Started</span>
          <span className="text-white/40 text-xs">{doneCount}/{tasks.length}</span>
        </span>
        <span className="text-white/40 text-xs">{collapsed ? '▾' : '▴'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 pt-1">
          {justEarned > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-green-400 font-heading mb-2">
              +{justEarned} coins earned <JesterCoin size={12} />
            </div>
          )}
          <div className="space-y-1.5">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${t.done ? 'bg-green-500/80 text-white' : 'bg-black/30 border border-white/20 text-transparent'}`}>
                  &#10003;
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-heading leading-tight ${t.done ? 'text-white/40 line-through' : 'text-white/90'}`}>{t.label}</p>
                  {!t.done && <p className="text-[9px] text-white/35 leading-tight">{t.hint}</p>}
                </div>
                <span className={`shrink-0 flex items-center gap-0.5 text-[10px] font-heading ${t.done ? 'text-white/25' : 'text-amber-400/80'}`}>
                  +{CHECKLIST_TASK_REWARD} <JesterCoin size={10} />
                </span>
              </div>
            ))}
          </div>

          {allDone ? (
            <div className="mt-3 text-center">
              <p className="text-green-400 font-heading text-xs mb-2">All done! +{CHECKLIST_COMPLETE_BONUS} bonus claimed.</p>
              <button onClick={dismiss}
                className="px-4 py-1.5 rounded-lg text-[10px] font-heading uppercase tracking-wider
                           bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors">
                Dismiss
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-center gap-2">
              <p className="text-[9px] text-white/30 text-center">Complete all {tasks.length} for a +{CHECKLIST_COMPLETE_BONUS} coin bonus</p>
              <button onClick={dismiss} className="text-[9px] text-white/25 hover:text-white/50 cursor-pointer transition-colors">Hide</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
