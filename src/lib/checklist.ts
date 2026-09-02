import { supabase } from './supabase';
import { addCoins } from './coins';

/** Getting Started checklist — one-time onboarding goals with small coin rewards. */

export const CHECKLIST_TASK_REWARD = 25;
export const CHECKLIST_COMPLETE_BONUS = 75;

const DEFAULT_COLOR = 'sandstone';

export interface ChecklistTask {
  id: string;
  label: string;
  hint: string;
  done: boolean;
}

// Stable, human-readable reasons — also used as the idempotency key in coin_transactions
const TASK_DEFS: { id: string; label: string; hint: string; reason: string }[] = [
  { id: 'tutorial',  label: 'Finish the tutorial',    hint: 'Learn the basics',        reason: 'Getting Started: Tutorial' },
  { id: 'first_win', label: 'Win your first game',    hint: 'Beat the computer',       reason: 'Getting Started: First win' },
  { id: 'color',     label: 'Pick your stone color',  hint: 'Make it yours',           reason: 'Getting Started: Stone color' },
  { id: 'daily',     label: 'Claim your daily bonus', hint: 'Free coins every day',    reason: 'Getting Started: Daily bonus' },
  { id: 'refer',     label: 'Invite a friend who joins', hint: 'Earn big referral coins', reason: 'Getting Started: Referral' },
];
const BONUS_REASON = 'Getting Started: All complete';

/**
 * Loads checklist completion from existing signals and pays any earned-but-unpaid
 * rewards. Payouts are idempotent (keyed on coin_transactions.reason), so clearing
 * localStorage or reloading can never double-pay.
 */
export async function loadChecklist(playerId: string): Promise<{ tasks: ChecklistTask[]; earned: number; allDone: boolean }> {
  const [{ data: stats }, { count: referralCount }] = await Promise.all([
    supabase.from('player_stats').select('wins, selected_color, last_daily_bonus').eq('player_id', playerId).single(),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('referred_by', playerId),
  ]);

  const done: Record<string, boolean> = {
    tutorial: localStorage.getItem('stone_tutorial_complete') === '1',
    first_win: (stats?.wins ?? 0) > 0 || localStorage.getItem('stone_first_win_done') === '1',
    color: !!stats?.selected_color && stats.selected_color !== DEFAULT_COLOR,
    daily: !!stats?.last_daily_bonus,
    refer: (referralCount ?? 0) > 0,
  };

  // Which rewards were already paid?
  const reasons = TASK_DEFS.map(t => t.reason).concat(BONUS_REASON);
  const { data: paidRows } = await supabase
    .from('coin_transactions')
    .select('reason')
    .eq('player_id', playerId)
    .in('reason', reasons);
  const paid = new Set((paidRows || []).map(r => r.reason));

  let earned = 0;
  for (const t of TASK_DEFS) {
    if (done[t.id] && !paid.has(t.reason)) {
      await addCoins(playerId, CHECKLIST_TASK_REWARD, t.reason);
      earned += CHECKLIST_TASK_REWARD;
    }
  }

  const allDone = TASK_DEFS.every(t => done[t.id]);
  if (allDone && !paid.has(BONUS_REASON)) {
    await addCoins(playerId, CHECKLIST_COMPLETE_BONUS, BONUS_REASON);
    earned += CHECKLIST_COMPLETE_BONUS;
  }

  const tasks = TASK_DEFS.map(t => ({ id: t.id, label: t.label, hint: t.hint, done: done[t.id] }));
  return { tasks, earned, allDone };
}
