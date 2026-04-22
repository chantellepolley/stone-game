import { supabase } from './supabase';
import { addCoins } from './coins';
import type { GameState, PlayerId } from '../types/game';

export interface BonusResult {
  type: string;
  amount: number;
  label: string;
}

/** Speed bonus: win in under 30 turns = +10 coins */
const SPEED_THRESHOLD = 30;
const SPEED_BONUS = 10;

/** Perfect game: no pieces captured by opponent = +15 */
const PERFECT_BONUS = 15;

/** Jester bonus: more double jesters than opponent = +10 */
const JESTER_BONUS = 10;

/** Doubles bonus: more regular doubles than opponent = +5 */
const DOUBLES_BONUS = 5;

/** Win streak bonuses */
const WIN_STREAK_BONUSES: Record<number, number> = { 3: 10, 5: 25, 10: 50 };

/** Win milestone bonuses */
function getMilestoneBonus(totalWins: number): number | null {
  if (totalWins > 0 && totalWins % 25 === 0) return 100;
  if (totalWins > 0 && totalWins % 10 === 0) return 50;
  return null;
}

/**
 * Evaluate all end-of-game bonuses for a winning player.
 * Returns the list of bonuses earned (does NOT award coins — caller does that).
 */
export function evaluateBonuses(
  state: GameState,
  winnerPlayer: PlayerId,
  newWinStreak: number,
  totalWins: number,
): BonusResult[] {
  const bonuses: BonusResult[] = [];
  const loser: PlayerId = winnerPlayer === 1 ? 2 : 1;

  // 1. Win streak
  const streakBonus = WIN_STREAK_BONUSES[newWinStreak];
  if (streakBonus) {
    bonuses.push({ type: 'win_streak', amount: streakBonus, label: `${newWinStreak} win streak!` });
  }

  // 2. Perfect game — opponent captured 0 of your pieces
  const opponentCaptures = state.captureCount?.[loser] || 0;
  if (opponentCaptures === 0) {
    bonuses.push({ type: 'perfect', amount: PERFECT_BONUS, label: 'Perfect game — no pieces lost!' });
  }

  // 3. Speed bonus
  if (state.turnCount < SPEED_THRESHOLD) {
    bonuses.push({ type: 'speed', amount: SPEED_BONUS, label: `Speed win — under ${SPEED_THRESHOLD} turns!` });
  }

  // 4. More double jesters than opponent
  const myJesters = state.jesterCount?.[winnerPlayer] || 0;
  const oppJesters = state.jesterCount?.[loser] || 0;
  if (myJesters > oppJesters && myJesters > 0) {
    bonuses.push({ type: 'jesters', amount: JESTER_BONUS, label: `Jester master — ${myJesters} vs ${oppJesters} double jesters!` });
  }

  // 5. More regular doubles than opponent
  const myDoubles = state.doublesCount?.[winnerPlayer] || 0;
  const oppDoubles = state.doublesCount?.[loser] || 0;
  if (myDoubles > oppDoubles && myDoubles > 0) {
    bonuses.push({ type: 'doubles', amount: DOUBLES_BONUS, label: `Doubles luck — ${myDoubles} vs ${oppDoubles} doubles!` });
  }

  // 6. Win milestones
  const milestone = getMilestoneBonus(totalWins);
  if (milestone) {
    bonuses.push({ type: 'milestone', amount: milestone, label: `${totalWins} wins milestone!` });
  }

  return bonuses;
}

/**
 * Award all bonuses for a player and log transactions.
 * Also updates win streak in player_stats.
 * Returns the list of bonuses awarded.
 */
export async function awardGameBonuses(
  playerId: string,
  state: GameState,
  winnerPlayer: PlayerId,
  isWinner: boolean,
): Promise<BonusResult[]> {
  // Get current stats
  const { data: stats } = await supabase
    .from('player_stats')
    .select('win_streak, best_win_streak, wins')
    .eq('player_id', playerId)
    .single();

  if (!stats) return [];

  if (isWinner) {
    const newStreak = (stats.win_streak || 0) + 1;
    const newBest = Math.max(newStreak, stats.best_win_streak || 0);
    const totalWins = (stats.wins || 0); // wins already incremented by recordGameResult

    // Update streak
    await supabase.from('player_stats').update({
      win_streak: newStreak,
      best_win_streak: newBest,
    }).eq('player_id', playerId);

    // Evaluate bonuses
    const bonuses = evaluateBonuses(state, winnerPlayer, newStreak, totalWins);

    // Award each bonus
    for (const bonus of bonuses) {
      await addCoins(playerId, bonus.amount, bonus.label);
    }

    return bonuses;
  } else {
    // Loss resets win streak
    await supabase.from('player_stats').update({
      win_streak: 0,
    }).eq('player_id', playerId);

    return [];
  }
}

/**
 * Award referral bonus to both players.
 */
export async function awardReferralBonus(referrerId: string, newPlayerId: string) {
  await addCoins(referrerId, 50, 'Referral bonus — friend joined!');
  await addCoins(newPlayerId, 50, 'Welcome bonus — referred by a friend!');
}
