export type PlayerId = 1 | 2;

export interface Piece {
  id: string;
  owner: PlayerId;
  crowned: boolean;
  /** Position in the player's route (0-29). -1 = not on board (bench/jail). */
  routePos: number;
}

export type GamePhase = 'rolling' | 'moving' | 'game_over';

export interface DiceState {
  values: [number, number];
  remaining: number[];
  hasRolled: boolean;
  /** True when double Jokers were rolled and the player still needs to choose their doubles value */
  pendingDoubleJoker: boolean;
}

export interface MoveLogEntry {
  turn: number;
  player: PlayerId;
  action: string;
  timestamp: number;
}

export interface GameState {
  board: Piece[][];              // board[0..19], each is an array of Piece
  bench: Record<PlayerId, Piece[]>; // Starting area — pieces not yet entered
  jail: Record<PlayerId, Piece[]>;
  home: Record<PlayerId, Piece[]>; // Borne-off pieces
  currentPlayer: PlayerId;
  dice: DiceState;
  phase: GamePhase;
  winner: PlayerId | null;
  moveLog: MoveLogEntry[];
  turnCount: number;
}

export type MoveSource =
  | { type: 'board'; index: number }
  | { type: 'jail' }
  | { type: 'bench' };

export type MoveTarget =
  | { type: 'board'; index: number }
  | { type: 'home' };

export interface Move {
  pieceId: string;
  from: MoveSource;
  to: MoveTarget;
  /** Total spaces moved */
  diceValue: number;
  /** How many dice this move consumes (1 for normal, 2+ for combined) */
  diceCount: number;
  /** Specific die values consumed (for mixed-value combos like 5+2=7) */
  diceConsumed: number[];
  captures: boolean;
  crowns: boolean;
  bearsOff: boolean;
}

export type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'SELECT_MOVE'; move: Move }
  | { type: 'CHOOSE_JOKER_DOUBLES'; value: number }
  | { type: 'UNDO_MOVE' }
  | { type: 'RESTART_GAME' };
