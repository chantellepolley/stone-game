export interface StoneColor {
  id: string;
  name: string;
  tint: string;       // rgba overlay for normal pieces
  tintCrowned: string; // rgba overlay for crowned pieces
  border: string;      // border color
  ring: string;        // tailwind ring class for highlights
  pulse: string;       // pulse animation class
  gradient?: string;   // CSS gradient (replaces solid tint if set)
  gradientCrowned?: string;
  premium?: boolean;   // requires coin purchase
  price?: number;      // coin cost to unlock
}

export const STONE_COLORS: StoneColor[] = [
  {
    id: 'sandstone',
    name: 'Sandstone',
    tint: 'rgba(200, 140, 60, 0.25)',
    tintCrowned: 'rgba(180, 120, 40, 0.35)',
    border: 'rgba(160,120,70,0.5)',
    ring: 'ring-amber-400',
    pulse: 'pulse-gold',
  },
  {
    id: 'slate',
    name: 'Slate',
    tint: 'rgba(70, 110, 150, 0.25)',
    tintCrowned: 'rgba(60, 80, 140, 0.35)',
    border: 'rgba(80,120,160,0.5)',
    ring: 'ring-sky-400',
    pulse: 'pulse-blue',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    tint: 'rgba(40, 160, 80, 0.25)',
    tintCrowned: 'rgba(30, 120, 60, 0.35)',
    border: 'rgba(50,140,80,0.5)',
    ring: 'ring-emerald-400',
    pulse: 'pulse-gold',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    tint: 'rgba(180, 50, 50, 0.25)',
    tintCrowned: 'rgba(150, 40, 40, 0.35)',
    border: 'rgba(160,60,60,0.5)',
    ring: 'ring-red-400',
    pulse: 'pulse-gold',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    tint: 'rgba(130, 60, 180, 0.25)',
    tintCrowned: 'rgba(100, 40, 150, 0.35)',
    border: 'rgba(120,70,170,0.5)',
    ring: 'ring-purple-400',
    pulse: 'pulse-blue',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    tint: 'rgba(30, 30, 30, 0.3)',
    tintCrowned: 'rgba(20, 20, 20, 0.4)',
    border: 'rgba(80,80,80,0.5)',
    ring: 'ring-gray-400',
    pulse: 'pulse-gold',
  },
  {
    id: 'gold',
    name: 'Gold',
    tint: 'rgba(220, 180, 40, 0.25)',
    tintCrowned: 'rgba(200, 160, 30, 0.35)',
    border: 'rgba(200,170,50,0.5)',
    ring: 'ring-yellow-400',
    pulse: 'pulse-gold',
  },
  {
    id: 'ivory',
    name: 'Ivory',
    tint: 'rgba(255, 250, 240, 0.45)',
    tintCrowned: 'rgba(245, 240, 225, 0.5)',
    border: 'rgba(230,225,210,0.7)',
    ring: 'ring-amber-200',
    pulse: 'pulse-gold',
  },
  // ── Premium colors (25 coins each) ──
  {
    id: 'rainbow',
    name: 'Rainbow',
    tint: 'rgba(200, 100, 100, 0.2)',
    tintCrowned: 'rgba(200, 100, 100, 0.3)',
    border: 'rgba(255,255,255,0.35)',
    ring: 'ring-white/60',
    pulse: 'pulse-gold',
    gradient: 'linear-gradient(135deg, rgba(255,0,0,0.25), rgba(255,165,0,0.25), rgba(255,255,0,0.25), rgba(0,200,0,0.25), rgba(0,100,255,0.25), rgba(140,0,255,0.25))',
    gradientCrowned: 'linear-gradient(135deg, rgba(255,0,0,0.35), rgba(255,165,0,0.35), rgba(255,255,0,0.35), rgba(0,200,0,0.35), rgba(0,100,255,0.35), rgba(140,0,255,0.35))',
    premium: true,
    price: 25,
  },
  {
    id: 'zebra',
    name: 'Zebra',
    tint: 'rgba(30, 30, 30, 0.2)',
    tintCrowned: 'rgba(30, 30, 30, 0.3)',
    border: 'rgba(100,100,100,0.5)',
    ring: 'ring-gray-300',
    pulse: 'pulse-gold',
    gradient: 'repeating-linear-gradient(45deg, rgba(10,10,10,0.35) 0px, rgba(10,10,10,0.35) 4px, rgba(240,240,240,0.3) 4px, rgba(240,240,240,0.3) 8px)',
    gradientCrowned: 'repeating-linear-gradient(45deg, rgba(10,10,10,0.45) 0px, rgba(10,10,10,0.45) 4px, rgba(240,240,240,0.35) 4px, rgba(240,240,240,0.35) 8px)',
    premium: true,
    price: 25,
  },
  {
    id: 'infrared',
    name: 'Infrared',
    tint: 'rgba(160, 40, 120, 0.25)',
    tintCrowned: 'rgba(140, 30, 100, 0.35)',
    border: 'rgba(180,50,130,0.5)',
    ring: 'ring-fuchsia-400',
    pulse: 'pulse-blue',
    gradient: 'linear-gradient(135deg, rgba(220,30,30,0.3), rgba(160,30,180,0.3))',
    gradientCrowned: 'linear-gradient(135deg, rgba(220,30,30,0.4), rgba(160,30,180,0.4))',
    premium: true,
    price: 25,
  },
  {
    id: 'arctic',
    name: 'Arctic',
    tint: 'rgba(80, 200, 180, 0.25)',
    tintCrowned: 'rgba(60, 180, 160, 0.35)',
    border: 'rgba(80,200,180,0.5)',
    ring: 'ring-teal-400',
    pulse: 'pulse-blue',
    gradient: 'linear-gradient(135deg, rgba(100,220,140,0.3), rgba(60,160,220,0.3))',
    gradientCrowned: 'linear-gradient(135deg, rgba(100,220,140,0.4), rgba(60,160,220,0.4))',
    premium: true,
    price: 25,
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    tint: 'rgba(255, 120, 0, 0.25)',
    tintCrowned: 'rgba(255, 100, 0, 0.35)',
    border: 'rgba(255,80,0,0.5)',
    ring: 'ring-orange-400',
    pulse: 'pulse-gold',
    gradient: 'radial-gradient(circle at 30% 30%, rgba(255,220,50,0.35), rgba(255,100,0,0.3), rgba(200,30,0,0.25))',
    gradientCrowned: 'radial-gradient(circle at 30% 30%, rgba(255,220,50,0.45), rgba(255,100,0,0.4), rgba(200,30,0,0.35))',
    premium: true,
    price: 25,
  },
  {
    id: 'frost',
    name: 'Frostbite',
    tint: 'rgba(180, 220, 255, 0.25)',
    tintCrowned: 'rgba(160, 200, 240, 0.35)',
    border: 'rgba(150,200,255,0.5)',
    ring: 'ring-blue-300',
    pulse: 'pulse-blue',
    gradient: 'linear-gradient(180deg, rgba(220,240,255,0.35), rgba(100,180,255,0.25), rgba(200,230,255,0.3))',
    gradientCrowned: 'linear-gradient(180deg, rgba(220,240,255,0.45), rgba(100,180,255,0.35), rgba(200,230,255,0.4))',
    premium: true,
    price: 25,
  },
  {
    id: 'toxic',
    name: 'Toxic',
    tint: 'rgba(80, 220, 0, 0.25)',
    tintCrowned: 'rgba(60, 200, 0, 0.35)',
    border: 'rgba(100,255,0,0.4)',
    ring: 'ring-lime-400',
    pulse: 'pulse-gold',
    gradient: 'radial-gradient(circle at 60% 60%, rgba(150,255,0,0.35), rgba(0,180,0,0.25), rgba(0,80,0,0.3))',
    gradientCrowned: 'radial-gradient(circle at 60% 60%, rgba(150,255,0,0.45), rgba(0,180,0,0.35), rgba(0,80,0,0.4))',
    premium: true,
    price: 25,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    tint: 'rgba(10, 10, 40, 0.3)',
    tintCrowned: 'rgba(10, 10, 40, 0.4)',
    border: 'rgba(60,60,120,0.5)',
    ring: 'ring-indigo-400',
    pulse: 'pulse-blue',
    gradient: 'linear-gradient(135deg, rgba(10,10,50,0.4), rgba(40,20,80,0.35), rgba(10,10,50,0.4))',
    gradientCrowned: 'linear-gradient(135deg, rgba(10,10,50,0.5), rgba(40,20,80,0.45), rgba(10,10,50,0.5))',
    premium: true,
    price: 25,
  },
  // ── Ultra Premium colors (50 coins each) ──
  {
    id: 'commanders',
    name: 'Commanders',
    tint: 'rgba(100, 20, 20, 0.25)',
    tintCrowned: 'rgba(100, 20, 20, 0.35)',
    border: 'rgba(255,180,0,0.6)',
    ring: 'ring-yellow-500',
    pulse: 'pulse-gold',
    gradient: 'repeating-linear-gradient(135deg, rgba(130,20,20,0.4) 0px, rgba(130,20,20,0.4) 5px, rgba(255,180,0,0.35) 5px, rgba(255,180,0,0.35) 10px), repeating-linear-gradient(225deg, rgba(130,20,20,0.2) 0px, rgba(130,20,20,0.2) 5px, rgba(255,180,0,0.15) 5px, rgba(255,180,0,0.15) 10px)',
    gradientCrowned: 'repeating-linear-gradient(135deg, rgba(130,20,20,0.5) 0px, rgba(130,20,20,0.5) 5px, rgba(255,180,0,0.45) 5px, rgba(255,180,0,0.45) 10px), repeating-linear-gradient(225deg, rgba(130,20,20,0.25) 0px, rgba(130,20,20,0.25) 5px, rgba(255,180,0,0.2) 5px, rgba(255,180,0,0.2) 10px)',
    premium: true,
    price: 50,
  },
  {
    id: 'niners',
    name: '49ers',
    tint: 'rgba(170, 50, 30, 0.25)',
    tintCrowned: 'rgba(170, 50, 30, 0.35)',
    border: 'rgba(190,30,30,0.6)',
    ring: 'ring-yellow-500',
    pulse: 'pulse-gold',
    gradient: 'repeating-linear-gradient(135deg, rgba(190,30,30,0.4) 0px, rgba(190,30,30,0.4) 5px, rgba(200,170,55,0.35) 5px, rgba(200,170,55,0.35) 10px), repeating-linear-gradient(225deg, rgba(190,30,30,0.2) 0px, rgba(190,30,30,0.2) 5px, rgba(200,170,55,0.15) 5px, rgba(200,170,55,0.15) 10px)',
    gradientCrowned: 'repeating-linear-gradient(135deg, rgba(190,30,30,0.5) 0px, rgba(190,30,30,0.5) 5px, rgba(200,170,55,0.45) 5px, rgba(200,170,55,0.45) 10px), repeating-linear-gradient(225deg, rgba(190,30,30,0.25) 0px, rgba(190,30,30,0.25) 5px, rgba(200,170,55,0.2) 5px, rgba(200,170,55,0.2) 10px)',
    premium: true,
    price: 50,
  },
];

export function getStoneColor(id: string): StoneColor {
  return STONE_COLORS.find(c => c.id === id) || STONE_COLORS[0];
}

export function loadPlayerColor(): string {
  return localStorage.getItem('stone_color') || 'sandstone';
}

export function savePlayerColor(id: string) {
  localStorage.setItem('stone_color', id);
}
