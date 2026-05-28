import { createContext, useContext } from 'react';
import { getBoardTheme, type BoardTheme } from '../utils/boardThemes';

const defaultTheme = getBoardTheme('classic');

export const BoardThemeContext = createContext<BoardTheme>(defaultTheme);

export function useBoardTheme(): BoardTheme {
  return useContext(BoardThemeContext);
}
