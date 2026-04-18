import { useState, useEffect } from 'react';
import type { DiceState, GamePhase, PlayerId } from '../types/game';
import { GAME_CONFIG } from '../config/gameConfig';
import { isJester } from '../engine/dice';
import { playDiceRattle, playDiceSlam } from '../utils/sounds';
import { useStoneColorOverrides } from '../contexts/StoneColorContext';
import { getStoneColor, loadPlayerColor } from '../utils/stoneColors';

interface DiceAreaProps {
  dice: DiceState;
  phase: GamePhase;
  currentPlayer: PlayerId;
  onRoll: () => void;
  awaitingJesterChoice?: boolean;
  onChooseJesterDoubles?: (value: number) => void;
  isAITurn?: boolean;
  externalRolling?: boolean;
}

/** SVG dot positions for dice faces 1-5 */
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[20, 20]],
  2: [[10, 30], [30, 10]],
  3: [[10, 30], [20, 20], [30, 10]],
  4: [[10, 10], [30, 10], [10, 30], [30, 30]],
  5: [[10, 10], [30, 10], [20, 20], [10, 30], [30, 30]],
};

/** Jester face image on the die */
function JesterFaceImage({ faded }: { faded: boolean }) {
  return (
    <img
      src="/jester-dice.png"
      alt="Jester"
      className={`w-10 h-10 rounded-full object-cover ${faded ? 'opacity-40' : ''}`}
    />
  );
}

function DieFace({ value, used, rolling, player }: { value: number; used: boolean; rolling: boolean; player: PlayerId }) {
  const jester = isJester(value);
  const dots = !jester ? (DOT_POSITIONS[value] || []) : [];
  const isP1 = player === 1;
  const colorOverrides = useStoneColorOverrides();

  // Use custom stone colors for dice
  const colorId = isP1
    ? (colorOverrides.p1ColorId || loadPlayerColor())
    : (colorOverrides.p2ColorId || 'slate');
  const stoneColor = getStoneColor(colorId);

  const dotFaded = '#8b735580';

  return (
    <div className={`
      relative w-14 h-14 rounded-lg border-2 flex items-center justify-center shadow-lg
      ${used ? 'opacity-50' : ''}
      ${rolling ? 'dice-rolling' : ''}
      transition-opacity duration-300
    `}
    style={used ? {
      backgroundColor: '#3d3632',
      borderColor: 'rgba(107,95,85,0.4)',
    } : jester ? {
      backgroundImage: "url('/stone-bg.jpg')",
      backgroundSize: '80px',
      filter: 'brightness(1.2) contrast(1.1)',
      borderColor: stoneColor.border,
    } : {
      backgroundImage: "url('/stone-bg.jpg')",
      backgroundSize: '80px',
      filter: 'brightness(1.3) contrast(1.1)',
      borderColor: stoneColor.border,
      backgroundColor: stoneColor.tint,
    }}
    >
      {/* Color tint overlay */}
      {!used && !jester && (
        <div className="absolute inset-0 rounded-md" style={{ backgroundColor: stoneColor.tint }} />
      )}
      {jester ? (
        <JesterFaceImage faded={used} />
      ) : (
        <svg width="40" height="40" viewBox="0 0 40 40" className="relative z-10">
          {dots.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={used ? dotFaded : '#1a1510'}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export default function DiceArea({ dice, phase, currentPlayer, onRoll, awaitingJesterChoice, onChooseJesterDoubles, isAITurn, externalRolling }: DiceAreaProps) {
  const [rolling, setRolling] = useState(false);
  const [rollFaces, setRollFaces] = useState<[number, number]>([1, 1]);
  const canRoll = phase === 'rolling' && !isAITurn;

  // External rolling animation (AI / online opponent)
  useEffect(() => {
    if (!externalRolling) return;
    playDiceRattle();
    const interval = setInterval(() => {
      setRollFaces([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 80);
    return () => {
      clearInterval(interval);
      playDiceSlam();
    };
  }, [externalRolling]);
  const playerName = GAME_CONFIG.PLAYER_NAMES[currentPlayer];

  const handleRoll = () => {
    if (!canRoll) return;
    setRolling(true);

    // Play dice rattle sound
    playDiceRattle();

    // Rapidly cycle random faces for dramatic effect
    let count = 0;
    const totalCycles = 12;
    const interval = setInterval(() => {
      setRollFaces([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      count++;
      if (count >= totalCycles) {
        clearInterval(interval);
        // Slam stop — brief pause then reveal
        setTimeout(() => {
          setRolling(false);
          playDiceSlam();
          onRoll();
        }, 150);
      }
    }, 80); // 80ms per cycle × 12 = ~960ms of rolling
  };

  // Track which dice values have been used
  const hasAnyJester = isJester(dice.values[0]) || isJester(dice.values[1]);
  let diceUsed: boolean[];
  if (hasAnyJester) {
    // Any jester roll: both dice stay visible as long as moves remain
    const allUsed = dice.remaining.length === 0 && !dice.pendingDoubleJester;
    diceUsed = [allUsed, allUsed];
  } else {
    const remainingCopy = [...dice.remaining];
    diceUsed = dice.values.map((v) => {
      const idx = remainingCopy.indexOf(v);
      if (idx !== -1) {
        remainingCopy.splice(idx, 1);
        return false;
      }
      return true;
    });
  }

  // Describe what the jester did
  const hasJester = dice.hasRolled && (isJester(dice.values[0]) || isJester(dice.values[1]));
  const bothJesters = dice.hasRolled && isJester(dice.values[0]) && isJester(dice.values[1]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Dice display */}
      {(dice.hasRolled || rolling || externalRolling) && (
        <div className="flex gap-3">
          <DieFace
            value={(rolling || externalRolling) ? rollFaces[0] : dice.values[0]}
            used={(rolling || externalRolling) ? false : diceUsed[0]}
            rolling={!!(rolling || externalRolling)}
            player={currentPlayer}
          />
          <DieFace
            value={(rolling || externalRolling) ? rollFaces[1] : dice.values[1]}
            used={(rolling || externalRolling) ? false : diceUsed[1]}
            rolling={!!(rolling || externalRolling)}
            player={currentPlayer}
          />
        </div>
      )}

      {/* Jester explanation */}
      {dice.hasRolled && hasJester && phase === 'moving' && !awaitingJesterChoice && (
        <div className="text-xs text-amber-500/80 font-heading">
          {bothJesters && dice.remaining.length > 0
            ? 'Double Jesters! Use 1 & 2 first'
            : bothJesters
            ? 'Choose your doubles!'
            : `Jester! Doubles of ${dice.remaining[0] ?? '?'}`
          }
        </div>
      )}

      {/* Double Jester choice UI */}
      {awaitingJesterChoice && onChooseJesterDoubles && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-amber-500 font-heading">Choose your doubles:</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6].map(v => (
              <button
                key={v}
                onClick={() => onChooseJesterDoubles(v)}
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
      {dice.hasRolled && phase === 'moving' && !awaitingJesterChoice && dice.remaining.length > 0 && (
        <div className="text-xs text-stone-light font-bold">
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
