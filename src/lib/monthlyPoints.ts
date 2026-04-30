import { supabase } from './supabase';

const QUALIFY_THRESHOLD = 15;

/** Get current month key in YYYY-MM format (UTC) */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Get milliseconds until end of current month (UTC midnight on last day) */
export function getTimeUntilMonthEnd(): number {
  const now = new Date();
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return Math.max(0, endOfMonth.getTime() - now.getTime());
}

/** Ensure a row exists for this player+month, return current points */
async function ensureRow(playerId: string, month: string): Promise<number> {
  const { data } = await supabase
    .from('monthly_points')
    .select('points')
    .eq('player_id', playerId)
    .eq('month', month)
    .single();

  if (data) return data.points;

  await supabase.from('monthly_points').insert({
    player_id: playerId,
    month,
    points: 0,
  });
  return 0;
}

/** Add points for a player this month */
export async function addMonthlyPoints(
  playerId: string,
  points: number,
  field?: 'wins_online' | 'wins_ai_hard' | 'wins_ai_expert' | 'forfeits' | 'login_days'
): Promise<void> {
  const month = getCurrentMonth();
  const currentPoints = await ensureRow(playerId, month);
  const newTotal = currentPoints + points;

  const update: Record<string, any> = {
    points: newTotal,
    qualified: newTotal >= QUALIFY_THRESHOLD,
    updated_at: new Date().toISOString(),
  };

  // Increment the specific stat field if provided
  if (field) {
    // Use raw SQL increment since supabase-js doesn't have easy increment
    const { data: row } = await supabase
      .from('monthly_points')
      .select(field)
      .eq('player_id', playerId)
      .eq('month', month)
      .single();
    if (row) {
      update[field] = ((row as any)[field] || 0) + 1;
    }
  }

  await supabase
    .from('monthly_points')
    .update(update)
    .eq('player_id', playerId)
    .eq('month', month);
}

/** Calculate points for a game win */
export function calculateWinPoints(mode: string, aiDifficulty?: string, wager?: number): {
  points: number;
  field?: 'wins_online' | 'wins_ai_hard' | 'wins_ai_expert';
  breakdown: string[];
} {
  const breakdown: string[] = [];
  let points = 0;

  if (mode === 'ai') {
    if (aiDifficulty === 'hard') {
      points += 1;
      breakdown.push('Hard AI win: +1');
      return { points, field: 'wins_ai_hard', breakdown };
    } else if (aiDifficulty === 'expert') {
      points += 2;
      breakdown.push('Expert AI win: +2');
      return { points, field: 'wins_ai_expert', breakdown };
    }
    // Easy/medium = 0 points
    return { points: 0, breakdown: [] };
  }

  if (mode === 'online') {
    points += 3;
    breakdown.push('Online win: +3');

    if (wager && wager > 0) {
      points += 1; // base wager bonus
      breakdown.push('Wagered game: +1');
      if (wager >= 25) { points += 1; breakdown.push('Wager 25+: +1'); }
      if (wager >= 50) { points += 1; breakdown.push('Wager 50+: +1'); }
      if (wager >= 100) { points += 2; breakdown.push('Wager 100+: +2'); }
    }

    return { points, field: 'wins_online', breakdown };
  }

  return { points: 0, breakdown: [] };
}

/** Calculate bonus points from game performance */
export function calculateBonusPoints(
  winStreak: number,
  perfectGame: boolean,
  speedWin: boolean,
  doubleJesterMaster: boolean
): { points: number; breakdown: string[] } {
  let points = 0;
  const breakdown: string[] = [];

  if (winStreak === 3) { points += 2; breakdown.push('3 win streak: +2'); }
  if (winStreak === 5) { points += 5; breakdown.push('5 win streak: +5'); }
  if (winStreak === 10) { points += 10; breakdown.push('10 win streak: +10'); }
  if (perfectGame) { points += 3; breakdown.push('Perfect game: +3'); }
  if (speedWin) { points += 2; breakdown.push('Speed win: +2'); }
  if (doubleJesterMaster) { points += 1; breakdown.push('Jester master: +1'); }

  return { points, breakdown };
}

/** Get standings for the current month */
export async function getMonthlyStandings(month?: string): Promise<Array<{
  player_id: string;
  points: number;
  wins_online: number;
  wins_ai_hard: number;
  wins_ai_expert: number;
  forfeits: number;
  login_days: number;
  qualified: boolean;
  username?: string;
  avatar_url?: string | null;
}>> {
  const m = month || getCurrentMonth();
  const { data: standings } = await supabase
    .from('monthly_points')
    .select('player_id, points, wins_online, wins_ai_hard, wins_ai_expert, forfeits, login_days, qualified')
    .eq('month', m)
    .order('points', { ascending: false });

  if (!standings || standings.length === 0) return [];

  // Fetch player names
  const ids = standings.map(s => s.player_id);
  const { data: players } = await supabase
    .from('players')
    .select('id, username, avatar_url')
    .in('id', ids);

  const nameMap: Record<string, string> = {};
  const avatarMap: Record<string, string | null> = {};
  players?.forEach(p => { nameMap[p.id] = p.username; avatarMap[p.id] = p.avatar_url; });

  return standings.map(s => ({
    ...s,
    username: nameMap[s.player_id] || 'Unknown',
    avatar_url: avatarMap[s.player_id] || null,
  }));
}

/** Award daily login point (max 1 per day per month) */
export async function awardDailyLoginPoint(playerId: string): Promise<boolean> {
  const month = getCurrentMonth();
  await ensureRow(playerId, month);

  const { data } = await supabase
    .from('monthly_points')
    .select('login_days, updated_at')
    .eq('player_id', playerId)
    .eq('month', month)
    .single();

  if (!data) return false;

  // Check if already awarded today (UTC)
  const today = new Date().toISOString().slice(0, 10);
  const lastLoginKey = `stone_potm_login_${month}_${today}`;
  if (localStorage.getItem(lastLoginKey)) return false;

  localStorage.setItem(lastLoginKey, '1');
  await addMonthlyPoints(playerId, 1, 'login_days');
  return true;
}

/** Deduct points for forfeiting */
export async function deductForfeitPoints(playerId: string): Promise<void> {
  await addMonthlyPoints(playerId, -2, 'forfeits');
}
