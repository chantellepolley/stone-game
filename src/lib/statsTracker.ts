import { supabase } from './supabase';
import type { GameState, PlayerId } from '../types/game';

/**
 * Record a completed game's stats to the database.
 */
export async function recordGameResult(
  gameState: GameState,
  winnerId: PlayerId,
  player1DbId: string | null,
  player2DbId: string | null,
) {
  // Count captures (cumulative) and borne-off for each player
  const p1Home = gameState.home[1].length;
  const p2Home = gameState.home[2].length;
  const captures = gameState.captureCount || { 1: 0, 2: 0 };

  // Update winner stats
  const winnerDbId = winnerId === 1 ? player1DbId : player2DbId;
  const loserDbId = winnerId === 1 ? player2DbId : player1DbId;
  const winnerHome = winnerId === 1 ? p1Home : p2Home;
  const winnerCaptured = captures[winnerId]; // cumulative captures by winner
  const loserHome = winnerId === 1 ? p2Home : p1Home;
  const loserId: 1 | 2 = winnerId === 1 ? 2 : 1;
  const loserCaptured = captures[loserId];

  if (winnerDbId) {
    await updateStatsManually(winnerDbId, true, winnerCaptured, winnerHome);
  }

  if (loserDbId) {
    await updateStatsManually(loserDbId, false, loserCaptured, loserHome);
  }
}

async function updateStatsManually(
  playerId: string, isWin: boolean, captured: number, borneOff: number
) {
  const { data: existing } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .single();

  if (existing) {
    await supabase.from('player_stats').update({
      wins: existing.wins + (isWin ? 1 : 0),
      losses: existing.losses + (isWin ? 0 : 1),
      games_played: existing.games_played + 1,
      pieces_captured: existing.pieces_captured + captured,
      pieces_borne_off: existing.pieces_borne_off + borneOff,
      updated_at: new Date().toISOString(),
    }).eq('player_id', playerId);
  } else {
    await supabase.from('player_stats').insert({
      player_id: playerId,
      wins: isWin ? 1 : 0,
      losses: isWin ? 0 : 1,
      games_played: 1,
      pieces_captured: captured,
      pieces_borne_off: borneOff,
    });
  }
}
