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
    // Dark blue-gray frame with bright white marble spaces
    boardGradient: 'linear-gradient(135deg, #3a4450 0%, #2e3845 50%, #3a4450 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #445060 0%, #384555 50%, #445060 100%)',
    spaceTintLight: 'rgba(240,235,230,0.55)',
    spaceTintDark: 'rgba(220,215,210,0.5)',
    spaceBorder: 'rgba(200,195,190,0.6)',
    borderColor: '#556575',
    boxBg: '#3a4450',
    dividerColor: 'rgba(200,195,190,0.3)',
    spaceFilter: 'brightness(2.0) contrast(0.65) saturate(0.15)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(40,55,70,0.3)',
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
  {
    id: 'jade',
    name: 'Jade Temple',
    price: 150,
    boardGradient: 'linear-gradient(135deg, #1a3028 0%, #0f2018 50%, #1a3028 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #223830 0%, #182820 50%, #223830 100%)',
    spaceTintLight: 'rgba(60,160,100,0.3)',
    spaceTintDark: 'rgba(40,130,75,0.3)',
    spaceBorder: 'rgba(70,150,100,0.35)',
    borderColor: '#2a5a40',
    boxBg: '#1a3028',
    dividerColor: 'rgba(70,150,100,0.3)',
    spaceFilter: 'brightness(1.15) contrast(0.95) saturate(0.6)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(10,50,30,0.35)',
    description: 'Deep green polished stone, ancient temple vibe',
  },
  {
    id: 'aqua',
    name: 'Ocean Stone',
    price: 150,
    boardGradient: 'linear-gradient(135deg, #1a3040 0%, #0f2030 50%, #1a3040 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #223848 0%, #182838 50%, #223848 100%)',
    spaceTintLight: 'rgba(50,160,190,0.3)',
    spaceTintDark: 'rgba(30,130,160,0.3)',
    spaceBorder: 'rgba(60,150,180,0.35)',
    borderColor: '#2a5568',
    boxBg: '#1a3040',
    dividerColor: 'rgba(60,150,180,0.3)',
    spaceFilter: 'brightness(1.15) contrast(0.95) saturate(0.55)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(10,40,60,0.35)',
    description: 'Cool aqua tones, smooth ocean-worn stone',
  },
  {
    id: 'amber',
    name: 'Amber Forge',
    price: 125,
    boardGradient: 'linear-gradient(135deg, #3d2810 0%, #2a1a08 50%, #3d2810 100%)',
    boardGradientMobile: 'linear-gradient(135deg, #4a3218 0%, #382210 50%, #4a3218 100%)',
    spaceTintLight: 'rgba(220,140,40,0.3)',
    spaceTintDark: 'rgba(190,110,20,0.3)',
    spaceBorder: 'rgba(210,130,40,0.35)',
    borderColor: '#7a4a18',
    boxBg: '#3d2810',
    dividerColor: 'rgba(210,130,40,0.3)',
    spaceFilter: 'brightness(1.2) contrast(0.9) saturate(0.65)',
    pageBg: '#302b26',
    pageOverlay: 'rgba(80,40,0,0.25)',
    description: 'Warm orange-amber stone, like a blacksmith forge',
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
  // Sync to DB for cross-device + game creation
  syncThemeToDb(id);
}

async function syncThemeToDb(themeId: string) {
  try {
    const { supabase } = await import('../lib/supabase');
    const token = localStorage.getItem('stone_device_token');
    if (!token) return;
    const { data: player } = await supabase.from('players').select('id').eq('device_token', token).single();
    if (!player) return;
    await supabase.from('player_stats').update({ selected_theme: themeId }).eq('player_id', player.id);
    // Also update all active games where this player is host
    await supabase.from('games').update({ board_theme: themeId }).eq('player1_id', player.id).eq('status', 'active');
    await supabase.from('games').update({ board_theme: themeId }).eq('player1_id', player.id).eq('status', 'waiting');
  } catch { /* silent */ }
}

/** Sync theme between localStorage and DB on login.
 *  If localStorage has a non-classic theme but DB doesn't, push to DB + update games.
 *  If DB has a theme, pull to localStorage. */
export async function syncThemeFromDb(playerId: string) {
  try {
    const { supabase } = await import('../lib/supabase');
    const { data } = await supabase.from('player_stats').select('selected_theme').eq('player_id', playerId).single();
    const localTheme = localStorage.getItem('stone_board_theme') || 'classic';
    const dbTheme = data?.selected_theme || 'classic';

    if (dbTheme !== 'classic') {
      // DB has a theme — use it (DB is source of truth)
      localStorage.setItem('stone_board_theme', dbTheme);
    } else if (localTheme !== 'classic') {
      // localStorage has a theme but DB doesn't — push to DB and update games
      await supabase.from('player_stats').update({ selected_theme: localTheme }).eq('player_id', playerId);
      await supabase.from('games').update({ board_theme: localTheme }).eq('player1_id', playerId).eq('status', 'active');
      await supabase.from('games').update({ board_theme: localTheme }).eq('player1_id', playerId).eq('status', 'waiting');
    }
  } catch { /* silent */ }
}
