import { createContext, useContext } from 'react';
import type { Player } from '../hooks/usePlayer';

interface PlayerContextType {
  player: Player | null;
  isLoading: boolean;
  createPlayer: (username: string, password?: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<boolean>;
  login: (username: string, password: string) => Promise<string | true>;
  logout: () => void;
  updatePassword: (newPassword: string) => Promise<boolean>;
}

export const PlayerContext = createContext<PlayerContextType>({
  player: null,
  isLoading: true,
  createPlayer: async () => false,
  updateUsername: async () => false,
  updateAvatar: async () => false,
  login: async () => 'Not initialized',
  logout: () => {},
  updatePassword: async () => false,
});

export function usePlayerContext() {
  return useContext(PlayerContext);
}
