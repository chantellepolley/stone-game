import { createContext, useContext } from 'react';

interface StoneColorOverrides {
  p1ColorId?: string;
  p2ColorId?: string;
}

export const StoneColorContext = createContext<StoneColorOverrides>({});

export function useStoneColorOverrides() {
  return useContext(StoneColorContext);
}
