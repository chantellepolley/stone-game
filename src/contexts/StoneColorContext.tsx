import { createContext, useContext } from 'react';

interface StoneColorOverrides {
  p1ColorId?: string;
  p2ColorId?: string;
  p1BorderOverride?: string;
  p2BorderOverride?: string;
}

export const StoneColorContext = createContext<StoneColorOverrides>({});

export function useStoneColorOverrides() {
  return useContext(StoneColorContext);
}
