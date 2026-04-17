# STONE - The Game

A 2-player board game with ancient temple theme, playable in browser at **stonethegame.com**.

## Tech Stack
- React 18 + TypeScript
- Tailwind CSS v4 + Vite
- Supabase (Realtime channels, Postgres DB, Storage)
- Vercel (hosting, analytics, domain)
- GitHub repo: `chantellepolley/stone-game`

## Architecture

### Core Engine (`src/engine/`) — Pure functions, zero React dependency
- `state.ts` — `createInitialState()` 
- `dice.ts` — `rollDice()`, `isJester()` (face 6 = Jester)
- `moves.ts` — `getValidMoves()`, `getMultiStepMoves()`, `executeMove()`, `canPlayerMove()`
- `victory.ts` — `checkWinCondition()`
- `ai.ts` — `chooseBestMove()`, `chooseBestJesterValue()` with Easy/Medium/Hard difficulty

### Types (`src/types/game.ts`)
- `PlayerId` = 1 | 2
- `Piece` = { id, owner, crowned, routePos }
- `GameState` = { board, bench, jail, home, currentPlayer, dice, phase, gameMode, aiDifficulty, winner, moveLog, turnCount }
- `GamePhase` = 'not_started' | 'rolling' | 'moving' | 'no_moves' | 'game_over'
- `Move` = { pieceId, from, to, diceValue, diceCount, diceConsumed, captures, crowns, bearsOff }

### Game Config (`src/config/gameConfig.ts`)
All tunable rules constants. Key values:
- `NUM_SPACES`: 20 physical board spaces
- `ROUTE_LENGTH`: 30 (1.5 laps around the board)
- `NUM_PIECES`: 13 per player
- `HOME_STRETCH_LENGTH`: 10 (last 10 spaces = crowned zone)
- `PLAYER_ROUTE`: 30-step arrays for each player
- `DICE.jesterFace`: 6 (replaces the 6 with Jester)

### Board Layout
```
[P1 Start] [0][1][2][3][4] | [5][6][7][8][9]     [P1 Home]
                        JAIL (center)
[P2 Start] [19][18][17][16][15] | [14][13][12][11][10] [P2 Home]
```

Player 1 (Sunstone): top row L→R, wraps to bottom, bottom R→L visually, wraps back to top, top L→R again → Home
Player 2 (Moonstone): bottom row L→R visually, wraps to top, top R→L, wraps back to bottom → Home

### Hooks
- `useGame.ts` — Local/AI game state management (useState-based, not useReducer)
- `useOnlineGame.ts` — Online multiplayer via Supabase Realtime broadcast + DB persistence
- `usePlayer.ts` — Player identity (device token in localStorage, Supabase players table)
- `useIsMobile.ts` — Simple mobile detection (width < 1024 || touch)

### Components
- `Game.tsx` — Main game container for local/AI games
- `OnlineGame.tsx` — Online multiplayer container
- `Board.tsx` — Board rendering, click/drag handlers, animation
- `BoardSpace.tsx` — Individual space with piece stack
- `Piece.tsx` — Stone piece with texture, custom color tint, crowned jester image
- `StoneBox.tsx` — Start/Home boxes (shared component)
- `Jail.tsx` — "The Stoned Dungeon" (captured pieces)
- `DiceArea.tsx` — Dice display, roll animation, Jester choice UI
- `StartScreen.tsx` — Mode selection (2P, AI, Online) + nav buttons
- `OnlineLobby.tsx` — Create/join game, share invite, connecting/error states
- `MyGames.tsx` — List of active online games to resume
- `PlayerStats.tsx` — Win/loss/capture stats
- `Leaderboard.tsx` — Top 20 players by wins
- `ColorPicker.tsx` — 8 custom stone colors
- `UsernamePrompt.tsx` — First-time username entry
- `TurnIndicator.tsx` — Shows current player + username
- `MoveLog.tsx` — Scrollable action history
- `RulesPanel.tsx` — Collapsible rules reference
- `GameControls.tsx` — Undo/New Game buttons

### Supabase Setup
- **Project**: tabsvmsnkdltuzenhgkw
- **Anon key**: in `src/lib/supabase.ts`
- **Tables**: players, games, player_stats (all with RLS enabled, public read/write policies)
- **Storage**: avatars bucket (public, created but not yet wired to UI)
- **Realtime**: broadcast channels for online game state sync

### Database Schema
```sql
players: id (uuid PK), username, device_token (unique), avatar_url, created_at
games: id (uuid PK), room_code (unique), player1_id, player2_id, mode, state (jsonb), status, winner_id, created_at, updated_at
player_stats: player_id (uuid PK → players), wins, losses, games_played, pieces_captured, pieces_borne_off, updated_at
```

## Key Game Rules
1. Each player has 13 stones starting in bench (Start box)
2. 30-step route (1.5 laps around 20-space board)
3. Dice: 2d6, face 6 = Jester
4. Jester + X = doubles of X (4 moves). Double Jesters = must use 1+2 first, then choose any doubles (1-6)
5. Can't enter/exit board with a 6
6. Pieces crowned when entering home stretch (last 10 spaces of route)
7. Must be crowned to bear off. Exact roll required unless ALL pieces in last 5 spaces
8. Single opponent stone = capture → The Stoned Dungeon. Must re-enter jailed pieces first
9. Multi-step moves capture at intermediate positions ("en passant")
10. Doubles pool: 4×value, distributable as any combination (1 piece 4×, 2 pieces 2× each, etc.)

## Important Conventions
- **"Jester" not "Joker"** — renamed throughout codebase
- **routePos** on each Piece tracks position in the 30-step route (-1 = off board)
- **Mobile vs Desktop**: `useIsMobile()` hook controls drag-and-drop (disabled on mobile), piece selection, glow intensity
- **Wrap-around moves** (same source/destination space): requires explicit "Wrap Around" button, never auto-executes
- **Sound toggle**: global via `setSoundEnabled()` in `src/utils/sounds.ts`
- **Stone colors**: stored in localStorage (`stone_color`), 8 options defined in `src/utils/stoneColors.ts`
- **Active game recovery**: `stone_active_game` in localStorage persists gameId/roomCode/player for reconnection

## Current State / TODO
### Working
- ✅ Local 2-player hot-seat
- ✅ vs Computer (Easy/Medium/Hard AI with look-ahead)
- ✅ Online multiplayer with Supabase Realtime
- ✅ Save/resume online games via Supabase DB
- ✅ Auto-reconnect on mobile background/foreground
- ✅ User accounts (username + device token)
- ✅ Stats tracking (wins, losses, captures, borne-off)
- ✅ Leaderboard (top 20 by wins)
- ✅ Custom stone colors (8 options)
- ✅ Sound effects (crowned, home, jailed, dice roll, your-turn notification)
- ✅ Sound toggle
- ✅ Hints toggle
- ✅ Undo (within same turn)
- ✅ Piece animation (slide from source to destination)
- ✅ AI dice rolling animation
- ✅ Dramatic dice roll effect (shaking + cycling faces + sounds)
- ✅ Direct invite links (stonethegame.com/join/CODE)
- ✅ Native share button (Web Share API)
- ✅ Vercel Analytics
- ✅ Mobile responsive layout
- ✅ Copyright notice

### Not Yet Built
- Profile picture upload (avatars bucket created, column added, UI not wired)
- Edit username from settings (hook exists: `updateUsername`, no UI yet)
- Show opponent name/avatar clearly in online games
- Push notifications for "your turn"
- Custom stone colors for online opponents
- Error boundary for freeze/crash recovery

## File Structure
```
stone/
├── public/
│   ├── logo.png, jester.png, stone-bg.jpg, favicon.svg
├── src/
│   ├── main.tsx, App.tsx, index.css
│   ├── types/game.ts
│   ├── config/gameConfig.ts
│   ├── engine/ (state, dice, moves, victory, ai)
│   ├── hooks/ (useGame, useOnlineGame, usePlayer, useIsMobile)
│   ├── components/ (Game, Board, Piece, DiceArea, etc.)
│   ├── contexts/PlayerContext.tsx
│   ├── lib/ (supabase, statsTracker)
│   ├── utils/ (boardLayout, sounds, stoneColors)
├── vercel.json (SPA rewrites for /join/CODE)
├── CLAUDE.md (this file)
```
