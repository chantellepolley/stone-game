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

/** Daily login bonus amount */
export const DAILY_BONUS = 20;

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

/** Claim daily login bonus. Returns new balance, or null if already claimed today. */
export async function claimDailyBonus(playerId: string): Promise<number | null> {
  const { data } = await supabase
    .from('player_stats')
    .select('coins, last_daily_bonus')
    .eq('player_id', playerId)
    .single();

  if (!data) return null;

  const today = new Date().toISOString().split('T')[0];
  if (data.last_daily_bonus === today) return null;

  const newBalance = (data.coins ?? STARTING_COINS) + DAILY_BONUS;
  await supabase
    .from('player_stats')
    .update({
      coins: newBalance,
      last_daily_bonus: today,
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', playerId);

  logTransaction(playerId, DAILY_BONUS, 'Daily login bonus', newBalance);
  return newBalance;
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
