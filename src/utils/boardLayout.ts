export interface SpacePosition {
  row: 'top' | 'bottom';
  col: number;        // 0-9 screen column
  quadrant: 1 | 2 | 3 | 4;
}

/**
 * Maps a board space index (0-19) to its screen position.
 *
 * Top row (left to right):    0  1  2  3  4  |  5  6  7  8  9
 * Bottom row (left to right): 19 18 17 16 15 | 14 13 12 11 10
 */
export function getSpacePosition(index: number): SpacePosition {
  if (index < 10) {
    return {
      row: 'top',
      col: index,
      quadrant: index < 5 ? 1 : 2,
    };
  }
  return {
    row: 'bottom',
    col: 19 - index,
    quadrant: index < 15 ? 3 : 4,
  };
}

/** Alternating light/dark stone for readability */
export function getSpaceVariant(index: number): 'light' | 'dark' {
  return index % 2 === 0 ? 'light' : 'dark';
}
