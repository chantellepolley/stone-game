export interface StoneColor {
  id: string;
  name: string;
  tint: string;       // rgba overlay for normal pieces
  tintCrowned: string; // rgba overlay for crowned pieces
  border: string;      // border color
  ring: string;        // tailwind ring class for highlights
  pulse: string;       // pulse animation class
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
    tint: 'rgba(240, 230, 210, 0.3)',
    tintCrowned: 'rgba(220, 210, 190, 0.35)',
    border: 'rgba(200,190,170,0.5)',
    ring: 'ring-amber-200',
    pulse: 'pulse-gold',
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
