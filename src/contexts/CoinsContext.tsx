import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getCoins, addCoins, deductCoins, claimDailyBonus } from '../lib/coins';
import { usePlayerContext } from './PlayerContext';

interface CoinsContextValue {
  coins: number | null;
  refreshCoins: () => Promise<void>;
  spend: (amount: number, reason?: string) => Promise<boolean>;
  earn: (amount: number, reason?: string) => Promise<void>;
  dailyBonusClaimed: boolean;
  dailyBonusAmount: number | null;
  dailyStreak: number;
  dismissDailyBonus: () => void;
}

const CoinsContext = createContext<CoinsContextValue>({
  coins: null,
  refreshCoins: async () => {},
  spend: async () => false,
  earn: async () => {},
  dailyBonusClaimed: false,
  dailyBonusAmount: null,
  dailyStreak: 0,
  dismissDailyBonus: () => {},
});

export function CoinsProvider({ children }: { children: React.ReactNode }) {
  const { player } = usePlayerContext();
  const [coins, setCoins] = useState<number | null>(null);
  const [dailyBonusAmount, setDailyBonusAmount] = useState<number | null>(null);
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const bonusChecked = useRef(false);

  const refreshCoins = useCallback(async () => {
    if (!player) return;
    const balance = await getCoins(player.id);
    setCoins(balance);
  }, [player]);

  // Load coins + check daily bonus on login
  useEffect(() => {
    if (!player || bonusChecked.current) return;
    bonusChecked.current = true;

    (async () => {
      // Try to claim daily bonus
      const result = await claimDailyBonus(player.id);
      if (result !== null) {
        setCoins(result.balance);
        setDailyBonusAmount(result.bonus);
        setDailyStreak(result.streak);
        setDailyBonusClaimed(true);
      } else {
        // Already claimed today, just load balance
        const balance = await getCoins(player.id);
        setCoins(balance);
      }
    })();
  }, [player]);

  const spend = useCallback(async (amount: number, reason = 'Game wager'): Promise<boolean> => {
    if (!player) return false;
    const result = await deductCoins(player.id, amount, reason);
    if (result === -1) return false;
    setCoins(result);
    return true;
  }, [player]);

  const earn = useCallback(async (amount: number, reason = 'Game winnings') => {
    if (!player) return;
    const result = await addCoins(player.id, amount, reason);
    setCoins(result);
  }, [player]);

  const dismissDailyBonus = useCallback(() => {
    setDailyBonusClaimed(false);
    setDailyBonusAmount(null);
  }, []);

  return (
    <CoinsContext.Provider value={{ coins, refreshCoins, spend, earn, dailyBonusClaimed, dailyBonusAmount, dailyStreak, dismissDailyBonus }}>
      {children}
    </CoinsContext.Provider>
  );
}

export function useCoins() {
  return useContext(CoinsContext);
}
