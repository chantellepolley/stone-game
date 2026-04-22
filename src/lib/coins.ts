import { supabase } from './supabase';
import type { AIDifficulty } from '../types/game';

/** Coin cost/reward for AI difficulty levels */
export const AI_WAGER: Record<AIDifficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 15,
  expert: 20,
};

/** Online wager tiers */
export const ONLINE_WAGER_TIERS = [0, 5, 10, 25, 50] as const;

/** Daily login bonus base amount */
export const DAILY_BONUS = 20;

/** Login streak bonus amounts by day */
export function getStreakBonus(streak: number): number {
  if (streak >= 7) return 50;
  if (streak >= 3) return 30;
  if (streak >= 2) return 25;
  return DAILY_BONUS;
}

/** Starting coins for new players */
export const STARTING_COINS = 100;

/** Log a coin transaction */
async function logTransaction(playerId: string, amount: number, reason: string, balanceAfter: number) {
  await supabase.from('coin_transactions').insert({
    player_id: playerId,
    amount,
    reason,
    balance_after: balanceAfter,
  });
}

/** Get a player's current coin balance */
export async function getCoins(playerId: string): Promise<number> {
  const { data } = await supabase
    .from('player_stats')
    .select('coins')
    .eq('player_id', playerId)
    .single();
  return data?.coins ?? STARTING_COINS;
}

/** Add coins to a player's balance */
export async function addCoins(playerId: string, amount: number, reason = 'Unknown'): Promise<number> {
  const current = await getCoins(playerId);
  const newBalance = current + amount;
  await supabase
    .from('player_stats')
    .update({ coins: newBalance, updated_at: new Date().toISOString() })
    .eq('player_id', playerId);
  logTransaction(playerId, amount, reason, newBalance);
  return newBalance;
}

/** Deduct coins from a player's balance. Returns new balance, or -1 if insufficient funds. */
export async function deductCoins(playerId: string, amount: number, reason = 'Unknown'): Promise<number> {
  const current = await getCoins(playerId);
  if (current < amount) return -1;
  const newBalance = current - amount;
  await supabase
    .from('player_stats')
    .update({ coins: newBalance, updated_at: new Date().toISOString() })
    .eq('player_id', playerId);
  logTransaction(playerId, -amount, reason, newBalance);
  return newBalance;
}

/** Claim daily login bonus. Returns { balance, bonus, streak } or null if already claimed today. */
export async function claimDailyBonus(playerId: string): Promise<{ balance: number; bonus: number; streak: number } | null> {
  const { data } = await supabase
    .from('player_stats')
    .select('coins, last_daily_bonus, login_streak, last_login_date')
    .eq('player_id', playerId)
    .single();

  if (!data) return null;

  const today = new Date().toISOString().split('T')[0];
  if (data.last_daily_bonus === today) return null;

  // Calculate streak: if last login was yesterday, increment. Otherwise reset to 1.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const wasYesterday = data.last_login_date === yesterdayStr || data.last_daily_bonus === yesterdayStr;
  const newStreak = wasYesterday ? (data.login_streak || 0) + 1 : 1;

  const bonus = getStreakBonus(newStreak);
  const newBalance = (data.coins ?? STARTING_COINS) + bonus;

  await supabase
    .from('player_stats')
    .update({
      coins: newBalance,
      last_daily_bonus: today,
      last_login_date: today,
      login_streak: newStreak,
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', playerId);

  const reason = newStreak > 1
    ? `Daily bonus (${newStreak}-day streak!)`
    : 'Daily login bonus';
  logTransaction(playerId, bonus, reason, newBalance);
  return { balance: newBalance, bonus, streak: newStreak };
}

/** Get coin transaction history */
export async function getCoinHistory(playerId: string, limit = 50): Promise<Array<{
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}>> {
  const { data } = await supabase
    .from('coin_transactions')
    .select('amount, reason, balance_after, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}
