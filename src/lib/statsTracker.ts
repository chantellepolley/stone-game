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
  // Count captures and borne-off for each player
  const p1Home = gameState.home[1].length;
  const p2Home = gameState.home[2].length;
  const p1Jail = gameState.jail[1].length;
  const p2Jail = gameState.jail[2].length;

  // Update winner stats
  const winnerDbId = winnerId === 1 ? player1DbId : player2DbId;
  const loserDbId = winnerId === 1 ? player2DbId : player1DbId;
  const winnerHome = winnerId === 1 ? p1Home : p2Home;
  const winnerCaptured = winnerId === 1 ? p2Jail : p1Jail; // opponent's jail = pieces we captured
  const loserHome = winnerId === 1 ? p2Home : p1Home;
  const loserCaptured = winnerId === 1 ? p1Jail : p2Jail;

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
