export type PlayerId = 1 | 2;

export interface Piece {
  id: string;
  owner: PlayerId;
  crowned: boolean;
  /** Position in the player's route (0-29). -1 = not on board (bench/jail). */
  routePos: number;
}

export type GamePhase = 'not_started' | 'rolling' | 'moving' | 'no_moves' | 'game_over';
export type GameMode = 'pvp' | 'ai';
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface DiceState {
  values: [number, number];
  remaining: number[];
  hasRolled: boolean;
  /** True when double Jesters were rolled and the player still needs to choose their doubles value */
  pendingDoubleJester: boolean;
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
  gameMode: GameMode;
  aiDifficulty: AIDifficulty;
  winner: PlayerId | null;
  moveLog: MoveLogEntry[];
  turnCount: number;
  /** Cumulative count of pieces each player has captured from their opponent */
  captureCount: Record<PlayerId, number>;
  /** Count of jesters rolled per player */
  jesterCount?: Record<PlayerId, number>;
  /** Count of doubles rolled per player */
  doublesCount?: Record<PlayerId, number>;
  /** Last move made (for replay on reconnect) */
  lastMove?: Move | null;
  /** Full sequence of moves from the last completed turn (for replay on reconnect) */
  lastTurnMoves?: {
    player: PlayerId;
    dice: [number, number];
    moves: Move[];
    /** Minimal board snapshot before the turn (no nested lastTurnMoves) */
    snapshot?: {
      board: Piece[][];
      bench: Record<PlayerId, Piece[]>;
      jail: Record<PlayerId, Piece[]>;
      home: Record<PlayerId, Piece[]>;
      currentPlayer: PlayerId;
    };
  } | null;
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
  | { type: 'START_GAME'; mode: GameMode; difficulty: AIDifficulty }
  | { type: 'ROLL_DICE' }
  | { type: 'SELECT_MOVE'; move: Move }
  | { type: 'CHOOSE_JESTER_DOUBLES'; value: number }
  | { type: 'UNDO_MOVE' }
  | { type: 'RESTART_GAME' };
