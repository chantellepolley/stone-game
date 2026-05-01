import { supabase } from './supabase';

const QUALIFY_THRESHOLD = 5;

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

/** First competition starts May 1, 2026 UTC */
const FIRST_COMPETITION = Date.UTC(2026, 4, 1, 0, 0, 0); // May = month 4 (0-indexed)

/** Check if the competition has started yet */
export function hasCompetitionStarted(): boolean {
  return Date.now() >= FIRST_COMPETITION;
}

/** Get milliseconds until competition starts */
export function getTimeUntilCompetitionStart(): number {
  return Math.max(0, FIRST_COMPETITION - Date.now());
}

/** Format a YYYY-MM string to a display name */
export function formatMonthName(month: string): string {
  const [year, m] = month.split('-');
  return new Date(Date.UTC(Number(year), Number(m) - 1, 15)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
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
  field?: 'wins_online' | 'wins_ai_hard' | 'wins_ai_expert' | 'forfeits' | 'login_days',
  reason?: string
): Promise<void> {
  if (points === 0) return;
  const month = getCurrentMonth();
  const currentPoints = await ensureRow(playerId, month);
  const newTotal = currentPoints + points;

  // Log the point entry
  if (reason) {
    await supabase.from('monthly_point_log').insert({
      player_id: playerId,
      month,
      points,
      reason,
    });
  }

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

  if (mode === 'online' || mode === 'pvp') {
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
  await addMonthlyPoints(playerId, 1, 'login_days', 'Daily login');
  return true;
}

/** Deduct points for forfeiting */
export async function deductForfeitPoints(playerId: string): Promise<void> {
  await addMonthlyPoints(playerId, -2, 'forfeits', 'Forfeited a game');
}

/** Check if previous month needs a winner crowned, and do it automatically */
export async function checkAndCrownWinner(): Promise<{
  winner?: { username: string; points: number; month: string };
  tie?: boolean;
} | null> {
  // Figure out the previous month
  const now = new Date();
  const prevDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

  // Don't check months before the competition started (May 2026)
  if (prevMonth < '2026-05') return null;

  // Check if already crowned
  const { data: existing } = await supabase
    .from('champions')
    .select('id')
    .eq('month', prevMonth)
    .single();
  if (existing) return null; // already crowned

  // Get standings for previous month
  const { data: standings } = await supabase
    .from('monthly_points')
    .select('player_id, points, qualified')
    .eq('month', prevMonth)
    .eq('qualified', true)
    .order('points', { ascending: false });

  if (!standings || standings.length === 0) return null; // no qualified players

  // Check for tie at the top
  const topScore = standings[0].points;
  const tiedPlayers = standings.filter(s => s.points === topScore);

  if (tiedPlayers.length >= 2) {
    // Check if tiebreaker games already created
    const { data: existingTiebreakers } = await supabase
      .from('tiebreaker_games')
      .select('id, status')
      .eq('month', prevMonth);

    if (!existingTiebreakers || existingTiebreakers.length === 0) {
      // Create round-robin tiebreaker games
      await createTiebreakerGames(prevMonth, tiedPlayers.map(p => p.player_id));
      return { tie: true };
    }

    // Check if all tiebreaker games are done
    const allDone = existingTiebreakers.every(t => t.status === 'completed');
    if (!allDone) return { tie: true }; // still waiting

    // All done — determine the round-robin winner
    const tiebreakerWinner = await determineTiebreakerWinner(prevMonth);
    if (!tiebreakerWinner) return { tie: true }; // still tied somehow

    // Crown the tiebreaker winner — continue below with winnerId overridden
    const winnerId2 = tiebreakerWinner;
    const winnerEntry = standings.find(s => s.player_id === winnerId2);
    if (!winnerEntry) return null;

    // Use the tiebreaker winner instead of falling through
    return await crownWinner(winnerId2, winnerEntry.points, prevMonth);
  }

  return await crownWinner(standings[0].player_id, standings[0].points, prevMonth);
}

/** Crown a POTM winner — award stone, coins, hall of fame, notifications */
async function crownWinner(winnerId: string, winnerPoints: number, month: string) {
  const stoneId = `champion-${month}`;

  await supabase.from('champions').insert({
    player_id: winnerId,
    month,
    points: winnerPoints,
    stone_id: stoneId,
  });

  const { data: stats } = await supabase
    .from('player_stats')
    .select('owned_colors, coins')
    .eq('player_id', winnerId)
    .single();

  const currentOwned: string[] = stats?.owned_colors || [];
  const currentCoins: number = stats?.coins || 0;
  if (!currentOwned.includes(stoneId)) {
    await supabase.from('player_stats').update({
      owned_colors: [...currentOwned, stoneId],
      selected_color: stoneId,
      coins: currentCoins + 500,
    }).eq('player_id', winnerId);
  }

  await supabase.from('coin_transactions').insert({
    player_id: winnerId,
    amount: 500,
    reason: `Player of the Month winner — ${formatMonthName(month)}!`,
    balance_after: currentCoins + 500,
  });

  const { sendPushNotification } = await import('../hooks/usePushNotifications');
  const { data: winnerPlayer } = await supabase.from('players').select('username').eq('id', winnerId).single();
  sendPushNotification(
    winnerId,
    'STONE — Player of the Month!',
    `Congratulations! You won Player of the Month for ${formatMonthName(month)}! You earned an exclusive champion stone and 500 coins!`,
    'potm-winner'
  );

  const { data: admin } = await supabase.from('players').select('id').ilike('username', 'cpolley').single();
  if (admin) {
    sendPushNotification(
      admin.id,
      'STONE — POTM Winner Crowned!',
      `${winnerPlayer?.username || 'Unknown'} won Player of the Month for ${formatMonthName(month)} with ${winnerPoints} points!`,
      'potm-crowned'
    );
  }

  return { winner: { username: winnerPlayer?.username || 'Unknown', points: winnerPoints, month } };
}

/** Create round-robin tiebreaker games between tied players */
async function createTiebreakerGames(month: string, playerIds: string[]): Promise<void> {
  const { sendPushNotification } = await import('../hooks/usePushNotifications');
  const { createInitialState } = await import('../engine');

  // Get player names for notifications
  const { data: players } = await supabase.from('players').select('id, username').in('id', playerIds);
  const nameMap: Record<string, string> = {};
  players?.forEach(p => { nameMap[p.id] = p.username; });

  // Create a game for each pair
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1 = playerIds[i];
      const p2 = playerIds[j];

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let k = 0; k < 5; k++) code += chars[Math.floor(Math.random() * chars.length)];

      const initialState = { ...createInitialState(), phase: 'rolling' as const, gameMode: 'pvp' as const, currentPlayer: 1 as const };

      const { data: game } = await supabase.from('games').insert({
        room_code: code,
        player1_id: p1,
        player2_id: p2,
        mode: 'online',
        state: initialState,
        status: 'active',
        wager: 0,
      }).select('id').single();

      if (game) {
        await supabase.from('tiebreaker_games').insert({
          month,
          game_id: game.id,
          player1_id: p1,
          player2_id: p2,
        });
      }
    }
  }

  // Notify all tied players
  const monthName = formatMonthName(month);
  const tiedNames = playerIds.map(id => nameMap[id] || 'Unknown').join(', ');
  for (const pid of playerIds) {
    sendPushNotification(
      pid,
      'STONE — Tiebreaker!',
      `You're tied for Player of the Month (${monthName})! Tiebreaker games have been created against ${tiedNames.replace(nameMap[pid] || '', '').replace(/^, |, $|, ,/g, '')}. Winner takes all!`,
      'potm-tiebreaker'
    );
  }

  // Notify admin
  const { data: admin } = await supabase.from('players').select('id').ilike('username', 'cpolley').single();
  if (admin) {
    sendPushNotification(admin.id, 'STONE — POTM Tiebreaker!', `Tie for ${monthName}: ${tiedNames}. Tiebreaker games created.`, 'potm-tiebreaker');
  }
}

/** Check tiebreaker results and determine winner (most wins, then total captures) */
async function determineTiebreakerWinner(month: string): Promise<string | null> {
  const { data: tiebreakers } = await supabase
    .from('tiebreaker_games')
    .select('player1_id, player2_id, winner_id, captures_p1, captures_p2')
    .eq('month', month)
    .eq('status', 'completed');

  if (!tiebreakers || tiebreakers.length === 0) return null;

  // Count wins and captures for each player
  const stats: Record<string, { wins: number; captures: number }> = {};
  for (const t of tiebreakers) {
    if (!stats[t.player1_id]) stats[t.player1_id] = { wins: 0, captures: 0 };
    if (!stats[t.player2_id]) stats[t.player2_id] = { wins: 0, captures: 0 };
    stats[t.player1_id].captures += t.captures_p1 || 0;
    stats[t.player2_id].captures += t.captures_p2 || 0;
    if (t.winner_id === t.player1_id) stats[t.player1_id].wins++;
    if (t.winner_id === t.player2_id) stats[t.player2_id].wins++;
  }

  // Sort by wins desc, then captures desc
  const sorted = Object.entries(stats).sort((a, b) => {
    if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
    return b[1].captures - a[1].captures;
  });

  if (sorted.length === 0) return null;
  // Only crown if there's a clear winner (not still tied on wins AND captures)
  if (sorted.length >= 2 && sorted[0][1].wins === sorted[1][1].wins && sorted[0][1].captures === sorted[1][1].captures) {
    return null; // still tied — extremely rare, admin handles manually
  }

  return sorted[0][0];
}

/** Record a tiebreaker game result (called when a tiebreaker game ends) */
export async function recordTiebreakerResult(gameId: string, winnerId: string, capturesP1: number, capturesP2: number): Promise<void> {
  await supabase.from('tiebreaker_games').update({
    winner_id: winnerId,
    captures_p1: capturesP1,
    captures_p2: capturesP2,
    status: 'completed',
  }).eq('game_id', gameId);

  // Check if all tiebreaker games for this month are done
  const { data: tb } = await supabase.from('tiebreaker_games').select('month').eq('game_id', gameId).single();
  if (tb) {
    // Re-run the crown check — it will see all games done and crown the winner
    await checkAndCrownWinner();
  }
}

/** Get a player's point log for the current month */
export async function getPointLog(playerId: string, month?: string): Promise<Array<{
  points: number;
  reason: string;
  created_at: string;
}>> {
  const m = month || getCurrentMonth();
  const { data } = await supabase
    .from('monthly_point_log')
    .select('points, reason, created_at')
    .eq('player_id', playerId)
    .eq('month', m)
    .order('created_at', { ascending: false });
  return data || [];
}
