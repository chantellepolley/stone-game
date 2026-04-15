import { useState } from 'react';
import type { DiceState, GamePhase, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import { isJoker } from '../engine/dice';

interface DiceAreaProps {
  dice: DiceState;
  phase: GamePhase;
  currentPlayer: PlayerId;
  onRoll: () => void;
  awaitingJokerChoice?: boolean;
  onChooseJokerDoubles?: (value: number) => void;
}

/** SVG dot positions for dice faces 1-5 */
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[20, 20]],
  2: [[10, 30], [30, 10]],
  3: [[10, 30], [20, 20], [30, 10]],
  4: [[10, 10], [30, 10], [10, 30], [30, 30]],
  5: [[10, 10], [30, 10], [20, 20], [10, 30], [30, 30]],
};

/** Joker/Jester face SVG drawn on the die */
function JokerFaceSVG({ faded }: { faded: boolean }) {
  const color = faded ? '#8b735560' : '#c62828';
  const accent = faded ? '#8b735540' : '#ff8f00';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Jester hat - three points */}
      <path d="M8 18 L14 6 L18 14 L20 4 L22 14 L26 6 L32 18"
        fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bells on hat tips */}
      <circle cx="14" cy="5" r="2" fill={accent} />
      <circle cx="20" cy="3" r="2" fill={accent} />
      <circle cx="26" cy="5" r="2" fill={accent} />
      {/* Face circle */}
      <circle cx="20" cy="24" r="10" fill={faded ? '#c4b59a30' : '#fff3e0'} stroke={color} strokeWidth="1.5" />
      {/* Eyes */}
      <path d="M15 22 L17 20 L15 22 L17 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M25 22 L23 20 L25 22 L23 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Wide grin */}
      <path d="M14 27 Q20 33 26 27" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Grin teeth marks */}
      <line x1="18" y1="28" x2="18" y2="30" stroke={color} strokeWidth="0.8" />
      <line x1="22" y1="28" x2="22" y2="30" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

function DieFace({ value, used, rolling, player }: { value: number; used: boolean; rolling: boolean; player: PlayerId }) {
  const joker = isJoker(value);
  const dots = !joker ? (DOT_POSITIONS[value] || []) : [];
  const isP1 = player === 1;

  // Player-colored dice — fully opaque
  const normalBg = isP1
    ? 'bg-player1 border-player1-accent shadow-lg'
    : 'bg-player2 border-player2-accent shadow-lg';
  const dotColor = isP1 ? '#3d2a14' : '#1a2e38';
  const dotFaded = '#8b735580';

  return (
    <div className={`
      relative w-14 h-14 rounded-lg border-2 flex items-center justify-center
      ${used
        ? 'bg-stone-dark border-stone-accent/40 opacity-50'
        : joker
          ? 'bg-amber-50 border-amber-600 shadow-lg'
          : normalBg
      }
      ${rolling ? 'dice-rolling' : ''}
      transition-opacity duration-300
    `}>
      {joker ? (
        <JokerFaceSVG faded={used} />
      ) : (
        <svg width="40" height="40" viewBox="0 0 40 40">
          {dots.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={used ? dotFaded : dotColor}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export default function DiceArea({ dice, phase, currentPlayer, onRoll, awaitingJokerChoice, onChooseJokerDoubles }: DiceAreaProps) {
  const [rolling, setRolling] = useState(false);
  const canRoll = phase === 'rolling';
  const playerName = GAME_CONFIG.PLAYER_NAMES[currentPlayer];

  const handleRoll = () => {
    if (!canRoll) return;
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      onRoll();
    }, 400);
  };

  // Track which dice values have been used
  const remainingCopy = [...dice.remaining];
  const diceUsed = dice.values.map((v) => {
    // For joker rolls, the remaining values differ from the face values.
    // A joker die is "used" once all remaining moves are consumed.
    const effectiveValue = isJoker(v)
      ? dice.remaining.length > 0 ? dice.remaining[0] : v
      : v;
    const idx = remainingCopy.indexOf(effectiveValue);
    if (idx !== -1) {
      remainingCopy.splice(idx, 1);
      return false;
    }
    return true;
  });

  // Describe what the joker did
  const hasJoker = dice.hasRolled && (isJoker(dice.values[0]) || isJoker(dice.values[1]));
  const bothJokers = dice.hasRolled && isJoker(dice.values[0]) && isJoker(dice.values[1]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Dice display */}
      {dice.hasRolled && (
        <div className="flex gap-3">
          <DieFace value={dice.values[0]} used={diceUsed[0]} rolling={rolling} player={currentPlayer} />
          <DieFace value={dice.values[1]} used={diceUsed[1]} rolling={rolling} player={currentPlayer} />
        </div>
      )}

      {/* Joker explanation */}
      {dice.hasRolled && hasJoker && phase === 'moving' && !awaitingJokerChoice && (
        <div className="text-xs text-amber-500/80 font-heading">
          {bothJokers && dice.remaining.length > 0
            ? 'Double Jokers! Use 1 & 2 first'
            : bothJokers
            ? 'Choose your doubles!'
            : `Joker! Doubles of ${dice.remaining[0] ?? '?'}`
          }
        </div>
      )}

      {/* Double Joker choice UI */}
      {awaitingJokerChoice && onChooseJokerDoubles && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-amber-500 font-heading">Choose your doubles:</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6].map(v => (
              <button
                key={v}
                onClick={() => onChooseJokerDoubles(v)}
                className="w-10 h-10 rounded-lg bg-stone-light border-2 border-amber-600/60
                           text-stone-bg font-bold text-lg
                           hover:bg-amber-100 hover:scale-110 active:scale-95
                           transition-all cursor-pointer shadow-md"
              >
                {v}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-stone-light/40">4 moves of your chosen value</div>
        </div>
      )}

      {/* Remaining moves indicator */}
      {dice.hasRolled && phase === 'moving' && !awaitingJokerChoice && dice.remaining.length > 0 && (
        <div className="text-xs text-stone-light/60">
          Moves left: {dice.remaining.join(', ')}
        </div>
      )}

      {/* Roll button */}
      {canRoll && !rolling && (
        <button
          onClick={handleRoll}
          className={`
            px-6 py-2.5 rounded-lg font-heading text-sm uppercase tracking-wider
            transition-all duration-200 cursor-pointer
            ${currentPlayer === 1
              ? 'bg-player1 hover:bg-player1-accent text-stone-bg'
              : 'bg-player2 hover:bg-player2-accent text-white'
            }
            shadow-lg hover:shadow-xl hover:scale-105 active:scale-95
          `}
        >
          Roll Dice — {playerName}
        </button>
      )}

      {rolling && (
        <div className="text-sm text-stone-light/60 italic">Rolling...</div>
      )}
    </div>
  );
}
