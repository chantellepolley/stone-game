import { supabase } from './supabase';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GameState, PlayerId } from '../types/game';

/**
 * Auto-forfeit for abandoned online games.
 *
 * If the player whose turn it is hasn't moved within this window, the other
 * player wins by timeout. STONE has no server-side scheduler, so settlement is
 * triggered lazily: whenever any participant next opens the app or their games
 * list, we scan their active games and settle any that have expired. The result
 * only matters when someone looks, so this is effectively "automatic" for both
 * players (the returning idle player will also see they lost).
 */
export const FORFEIT_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

/** Minimal shape of a `games` row needed to evaluate/settle a timeout. */
interface GameRow {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  status: string;
  state: GameState | null;
  wager: number | null;
  updated_at: string | null;
  created_at?: string | null;
}

/** Timestamp (ms) of the last actual move, ignoring chat/wager DB touches. */
function lastMoveTime(state: GameState, fallbackIso: string | null | undefined): number {
  const log = state.moveLog;
  if (log && log.length > 0) {
    const t = log[log.length - 1].timestamp;
    if (typeof t === 'number' && !Number.isNaN(t)) return t;
  }
  return fallbackIso ? new Date(fallbackIso).getTime() : Date.now();
}

/** How long (ms) until this game auto-forfeits, or null if not applicable. Negative = already expired. */
export function msUntilForfeit(state: GameState | null, updatedAt: string | null | undefined): number | null {
  if (!state || state.phase === 'game_over' || state.winner) return null;
  const elapsed = Date.now() - lastMoveTime(state, updatedAt);
  return FORFEIT_TIMEOUT_MS - elapsed;
}

/**
 * Settle a single game as a timeout forfeit if it has expired.
 * Idempotent and race-safe: only the first client to flip the row's status
 * away from 'active' performs the reward settlement. Returns the winning
 * PlayerId if this call settled the game, otherwise null.
 */
export async function settleIfTimedOut(game: GameRow): Promise<PlayerId | null> {
  // Only in-progress online games with a real opponent can time out.
  if (game.status !== 'active' || !game.player2_id) return null;
  const state = game.state;
  if (!state || state.phase === 'game_over' || state.winner) return null;
  const remaining = msUntilForfeit(state, game.updated_at);
  if (remaining === null || remaining > 0) return null;

  const idlePlayer = (state.currentPlayer === 2 ? 2 : 1) as PlayerId; // owes the move
  const winner = (idlePlayer === 1 ? 2 : 1) as PlayerId;
  const winnerDbId = winner === 1 ? game.player1_id : game.player2_id;
  const loserDbId = idlePlayer === 1 ? game.player1_id : game.player2_id;

  const finalState: GameState = {
    ...state,
    winner,
    phase: 'game_over',
    endReason: 'timeout',
    moveLog: [
      ...state.moveLog,
      {
        turn: state.turnCount,
        player: idlePlayer,
        action: `${GAME_CONFIG.PLAYER_NAMES[idlePlayer]} forfeited by timeout (no move in 2 weeks)`,
        timestamp: Date.now(),
      },
    ],
  };

  // Atomic claim: succeeds only while the row is still 'active'. If another
  // client settled it first, `.select()` returns no rows and we bail — no
  // double stats/coins/points.
  const { data: claimed } = await supabase
    .from('games')
    .update({
      status: 'completed',
      state: finalState,
      winner_id: winnerDbId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', game.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (!claimed) return null; // lost the race — already settled by someone else

  // ── Settle rewards (mirrors the normal game_over flow in useOnlineGame) ──
  const wager = game.wager || 0;
  const stateWithWager = { ...finalState, wager } as GameState & { wager: number };

  const { recordGameResult } = await import('./statsTracker');
  await recordGameResult(finalState, winner, game.player1_id, game.player2_id);

  // isForfeit=true suppresses skill bonuses (speed/perfect/jester/doubles) —
  // the opponent didn't play the game out, so those weren't earned.
  const { awardGameBonuses } = await import('./bonuses');
  if (winnerDbId) await awardGameBonuses(winnerDbId, stateWithWager, winner, true, game.id, true);
  if (loserDbId) await awardGameBonuses(loserDbId, stateWithWager, winner, false, game.id, true);

  // Winner collects the pot (both players' wagers).
  if (wager > 0 && winnerDbId) {
    const { addCoins } = await import('./coins');
    await addCoins(winnerDbId, wager * 2, 'Timeout forfeit win');
  }

  // Idle player loses monthly points, same as an active forfeit.
  if (loserDbId) {
    const { deductForfeitPoints } = await import('./monthlyPoints');
    await deductForfeitPoints(loserDbId).catch(() => {});
  }

  // Tell the winner they won (they may not have the game open).
  if (winnerDbId) {
    const { sendPushNotification } = await import('../hooks/usePushNotifications');
    sendPushNotification(
      winnerDbId,
      'STONE - You won by timeout!',
      'Your opponent ran out of time to move.',
      'game-over',
      `/join/${(game as { room_code?: string }).room_code || ''}`,
    ).catch(() => {});
  }

  return winner;
}

/**
 * Scan a player's active online games and settle any that have timed out.
 * Safe to call on app load and on the games screen; concurrent/duplicate calls
 * are deduped by the atomic claim in settleIfTimedOut(). Returns the ids of
 * games that were settled by this call.
 */
export async function settleStaleGames(playerId: string): Promise<string[]> {
  const { data: games } = await supabase
    .from('games')
    .select('id, room_code, player1_id, player2_id, status, state, wager, updated_at')
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .eq('status', 'active')
    .eq('mode', 'online')
    .limit(30);

  if (!games || games.length === 0) return [];

  const settled: string[] = [];
  for (const g of games as GameRow[]) {
    try {
      const winner = await settleIfTimedOut(g);
      if (winner) settled.push(g.id);
    } catch {
      // Never let one bad row block the rest.
    }
  }
  return settled;
}
