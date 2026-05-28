export interface BoardTheme {
  id: string;
  name: string;
  price: number; // 0 = free
  /** Board container gradient */
  boardGradient: string;
  boardGradientMobile: string;
  /** Space tint overlays */
  spaceTintLight: string;
  spaceTintDark: string;
  /** Space border */
  spaceBorder: string;
  /** Board/box border color */
  borderColor: string;
  /** Box background (start, home, jail) */
  boxBg: string;
  /** Divider color */
  dividerColor: string;
  /** Filter applied to stone-bg.jpg texture on spaces */
  spaceFilter: string;
  /** Optional CSS filter on the entire board for mood */
  boardFilter?: string;
  /** Page background — solid color or 'none' to keep default */
  pageBg: string;
  /** Semi-transparent overlay tint on the page background */
  pageOverlay?: string;
  /** Description shown in the shop */
  description: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic Slate',
    price: 0,
    boardGradient: 'linear-gradient(135deg, #3d3632 0%, #322d28 50%, #3d3632 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #4a4440 0%, #3d3835 50%, #4a4440 100%)',
    spaceTintLight: 'rgba(170,140,90,0.35)',
    spaceTintDark: 'rgba(120,95,60,0.35)',
    spaceBorder: 'rgba(120,110,95,0.4)',
    borderColor: '#5e5549',
    boxBg: '#3d3632',
    dividerColor: 'rgba(107,95,85,0.4)',
    spaceFilter: 'brightness(1.3) contrast(0.85) saturate(0.5)',
    pageBg: '#302b26',
    pageOverlay: undefined,
    description: 'The original stone board',
  },
  {
    id: 'marble',
    name: 'Marble Palace',
    price: 75,
    // Dark charcoal frame with bright white marble spaces
    boardGradient: 'linear-gradient(135deg, #4a4550 0%, #3a3540 50%, #4a4550 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #555060 0%, #454050 50%, #555060 100%)',
    spaceTintLight: 'rgba(240,235,230,0.55)',
    spaceTintDark: 'rgba(220,215,210,0.5)',
    spaceBorder: 'rgba(200,195,190,0.6)',
    borderColor: '#6a6570',
    boxBg: '#4a4550',
    dividerColor: 'rgba(200,195,190,0.3)',
    spaceFilter: 'brightness(2.0) contrast(0.65) saturate(0.15)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(60,55,70,0.3)',
    description: 'Bright white marble with a dark stone frame',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    price: 100,
    boardGradient: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 50%, #1a1a2e 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #222238 0%, #16162a 50%, #222238 100%)',
    spaceTintLight: 'rgba(60,60,100,0.4)',
    spaceTintDark: 'rgba(40,40,80,0.4)',
    spaceBorder: 'rgba(80,80,120,0.4)',
    borderColor: '#3a3a5c',
    boxBg: '#1a1a2e',
    dividerColor: 'rgba(80,80,120,0.4)',
    spaceFilter: 'brightness(1.1) contrast(1.1) saturate(0.3)',
    boardFilter: 'saturate(0.8)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(10,10,30,0.5)',
    description: 'Glossy black volcanic glass, sharp and sleek',
  },
  {
    id: 'lava',
    name: 'Lava Rock',
    price: 150,
    boardGradient: 'linear-gradient(135deg, #2d1810 0%, #1a0e08 50%, #2d1810 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #3a2015 0%, #2a1510 50%, #3a2015 100%)',
    spaceTintLight: 'rgba(200,80,20,0.3)',
    spaceTintDark: 'rgba(160,50,10,0.3)',
    spaceBorder: 'rgba(200,100,40,0.35)',
    borderColor: '#6b3020',
    boxBg: '#2d1810',
    dividerColor: 'rgba(200,80,20,0.3)',
    spaceFilter: 'brightness(1.1) contrast(1.0) saturate(0.6)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(80,20,0,0.3)',
    description: 'Dark stone with glowing red-orange cracks',
  },
  {
    id: 'gold',
    name: 'Gold Ore',
    price: 200,
    boardGradient: 'linear-gradient(135deg, #3d3520 0%, #2a2510 50%, #3d3520 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #4a4028 0%, #3a3018 50%, #4a4028 100%)',
    spaceTintLight: 'rgba(210,180,80,0.35)',
    spaceTintDark: 'rgba(180,150,50,0.35)',
    spaceBorder: 'rgba(200,170,60,0.4)',
    borderColor: '#8b7530',
    boxBg: '#3d3520',
    dividerColor: 'rgba(200,170,60,0.3)',
    spaceFilter: 'brightness(1.2) contrast(0.9) saturate(0.7)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(100,80,20,0.25)',
    description: 'Dark stone with rich gold veins running through',
  },
];

export function getBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find(t => t.id === id) || BOARD_THEMES[0];
}

export function loadBoardTheme(): string {
  return localStorage.getItem('stone_board_theme') || 'classic';
}

export function saveBoardTheme(id: string) {
  localStorage.setItem('stone_board_theme', id);
}
