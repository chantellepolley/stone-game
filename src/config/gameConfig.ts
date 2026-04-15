import type { PlayerId } from '../types/game';

/**
 * All game rules constants live here.
 * Change these values to tweak gameplay without touching logic code.
 */
export const GAME_CONFIG = {
  /** Total physical board spaces */
  NUM_SPACES: 20,

  /** Total steps in each player's route (1.5 laps around the board) */
  ROUTE_LENGTH: 30,

  /** Pieces per player */
  NUM_PIECES: 13,

  /** Board quadrant layout */
  NUM_QUADRANTS: 4,
  SPACES_PER_QUADRANT: 5,

  /**
   * Starting space index for each player (where bench pieces enter the board).
   * Player 1 enters at 0 (top-left), Player 2 enters at 19 (bottom-left as displayed).
   */
  PLAYER_START: { 1: 0, 2: 19 } as Record<PlayerId, number>,

  /**
   * Movement direction: +1 = clockwise, -1 = counter-clockwise.
   */
  PLAYER_DIRECTION: { 1: 1, 2: -1 } as Record<PlayerId, number>,

  /**
   * Canonical route for each player (30 steps = 1.5 laps).
   *
   * Display:
   *   [P1 start] [0] [1] [2] ... [8] [9]   [P1 home]
   *   [P2 start] [19][18][17]... [11][10]   [P2 home]
   *
   * Player 1 (clockwise): top L→R (0→9), wrap to bottom R (→10),
   *   bottom R→L (10→19), wrap to top L (→0), top L→R again (0→9), bear off at top-right.
   *
   * Player 2 (counter-clockwise): bottom L→R visually (19→18→...→10), wrap to top R (→9),
   *   top R→L (9→8→...→0), wrap to bottom L (→19), bottom L→R again (19→18→...→10),
   *   bear off at bottom-right.
   */
  PLAYER_ROUTE: {
    1: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,       // top row L→R
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, // bottom row (visually R→L)
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,         // top row L→R again → bear off
    ],
    2: [
      19, 18, 17, 16, 15, 14, 13, 12, 11, 10, // bottom row (visually L→R)
      9, 8, 7, 6, 5, 4, 3, 2, 1, 0,           // top row R→L
      19, 18, 17, 16, 15, 14, 13, 12, 11, 10,  // bottom row again → bear off
    ],
  } as Record<PlayerId, number[]>,

  /**
   * How many spaces from the end of the route constitute the "home stretch".
   * Pieces entering the home stretch become crowned.
   */
  HOME_STRETCH_LENGTH: 5,

  /** Dice configuration */
  DICE: {
    count: 2,
    faces: 6,
    /** If true, rolling doubles gives 4 moves of that value (backgammon-style) */
    doublesGrant4Moves: true,
    /**
     * The Joker face replaces the 6 on each die.
     * Rolling a Joker + any number X turns the roll into doubles of X (4 moves).
     * Rolling double Jokers = 4 moves of 5 (highest normal face).
     */
    jokerFace: 6,
    /** Value used when both dice are Jokers */
    doubleJokerValue: 5,
  },

  /**
   * A single opposing stone on a space can be captured.
   * If there are this many or fewer opposing pieces, capture is possible.
   */
  CAPTURE_MAX_OPPONENTS: 1,

  /**
   * Captured pieces lose their crowned status.
   */
  CAPTURE_REMOVES_CROWN: true,

  /**
   * Must a player use exact dice to bear off, or can they overshoot?
   * true = exact or higher (if it's the farthest piece)
   * false = must be exact
   */
  BEAR_OFF_ALLOW_OVERSHOOT: true,

  /** Player names for display */
  PLAYER_NAMES: { 1: 'Sunstone', 2: 'Moonstone' } as Record<PlayerId, string>,
} as const;
