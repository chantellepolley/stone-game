import { supabase } from './supabase';

const REFERRAL_PROMO = {
  id: 'referral-boost-may2026',
  startUtc: Date.UTC(2026, 4, 27, 0, 0, 0),  // May 27, 2026 midnight UTC
  endUtc:   Date.UTC(2026, 4, 29, 0, 0, 0),  // May 29, 2026 midnight UTC (48h)
  referrerCoins: 200,
  newPlayerCoins: 200,
  referrerPotmPoints: 25,
  maxReferralsDuringPromo: 5,
  adminOnly: false, // LIVE
  adminUsername: 'cpolley',
};

export function isPromoActive(username?: string): boolean {
  const now = Date.now();
  if (now < REFERRAL_PROMO.startUtc || now > REFERRAL_PROMO.endUtc) return false;
  if (REFERRAL_PROMO.adminOnly && username?.toLowerCase() !== REFERRAL_PROMO.adminUsername) return false;
  return true;
}

export function getPromoConfig() {
  return REFERRAL_PROMO;
}

export function getReferralAmounts(username?: string): {
  referrerCoins: number;
  newPlayerCoins: number;
  referrerPoints: number;
  isPromo: boolean;
} {
  if (isPromoActive(username)) {
    return {
      referrerCoins: REFERRAL_PROMO.referrerCoins,
      newPlayerCoins: REFERRAL_PROMO.newPlayerCoins,
      referrerPoints: REFERRAL_PROMO.referrerPotmPoints,
      isPromo: true,
    };
  }
  return { referrerCoins: 100, newPlayerCoins: 100, referrerPoints: 0, isPromo: false };
}

export function getPromoTimeRemaining(): number {
  return Math.max(0, REFERRAL_PROMO.endUtc - Date.now());
}

export async function checkReferralCap(referrerId: string): Promise<boolean> {
  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', referrerId)
    .gte('created_at', new Date(REFERRAL_PROMO.startUtc).toISOString())
    .lte('created_at', new Date(REFERRAL_PROMO.endUtc).toISOString());
  // count includes the current signup (referred_by is set before this check)
  return (count || 0) <= REFERRAL_PROMO.maxReferralsDuringPromo;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
  }
  return `${hours}h ${mins}m`;
}
