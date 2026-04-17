import { createContext, useContext } from 'react';
import type { Player } from '../hooks/usePlayer';

interface PlayerContextType {
  player: Player | null;
  isLoading: boolean;
  createPlayer: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<boolean>;
}

export const PlayerContext = createContext<PlayerContextType>({
  player: null,
  isLoading: true,
  createPlayer: async () => false,
  updateUsername: async () => false,
  updateAvatar: async () => false,
});

export function usePlayerContext() {
  return useContext(PlayerContext);
}
