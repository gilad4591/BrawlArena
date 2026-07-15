# Brawl Arena

A cross-platform 2.5D fighting / brawler in the spirit of *Little Fighter* — pick
an original fighter, then battle CPU opponents 1v1, free-for-all, or in teams on a
single screen. Built with **Vite + vanilla JS + HTML5 Canvas** and wrapped for
**iOS & Android** with **Capacitor**.

## Development milestones (big steps)

How the game grew, roughly in order:

1. **Core game** — 2.5D engine (physics, depth, combat, specials), touch +
   keyboard controls, difficulty-scaled AI, and modes (1v1 / free-for-all / teams).
2. **Real art pipeline** — replaced procedural rigs with AI-generated sprite
   sheets; built scripts to chroma-key/clean sheets, extract poses, and crop
   character portraits for the select screen & HUD.
3. **Roster & progression** — grew to **10 fighters** (plus unlockables), an XP /
   level system, and power-balanced stats across the cast.
4. **Depth features** — per-fighter special combos, pick-up props/weapons,
   timed player-only power-ups, screen shake / hit-stop / K.O. "game feel",
   survival podium & results screens.
5. **Solo Campaign** — 5 stages vs. Bruiser / Mage / Gang-Leader enemies with a
   two-phase boss fight.
6. **Multiplayer** — invite-code lobby + host-authoritative netcode over a small
   WebSocket relay (FFA / teams, random team assignment).
7. **Polish & UX** — main-menu splash art, boot loading screen, settings, stats,
   Hebrew translation with a language switcher (RTL), and app-lifecycle pause.
8. **Shipping** — AdMob/AdSense ads (interstitial every few rounds), full mobile
   **landscape** layout, GitHub Actions Android **AAB** build, Play Store assets,
   and a branded app icon.

> A fuller narrative of every step lives in the chat history; this list is the
> 10,000-ft view.

## Features

- **10 original fighters** (plus unlockables), each with unique stats and a
  signature special (fireball, freezing ice shard, thunder dash, ground AOE,
  launcher, homing orb, and more), balanced for comparable overall power.
- **Modes:** 1 v 1, Free-for-all (up to 8 CPUs, everyone for themselves), Teams,
  and a 5-stage **Solo Campaign**.
- **Difficulty:** Beginner / Pro / Expert (affects AI reaction, aggression,
  blocking, special usage, movement and damage).
- **2.5D depth movement** (x / depth / jump) like classic beat-em-ups.
- **Touch controls** (virtual joystick + Hit / Special / Jump / Defend) plus full
  keyboard support for desktop testing.
- **Multiplayer lobby infrastructure**: invitation-based with **random 6-digit
  codes** and a **fast expiry** (90s). See below.

## Run it

```bash
npm install
npm run dev        # open the printed localhost URL
```

### Controls

| Action  | Touch            | Keyboard            |
| ------- | ---------------- | ------------------- |
| Move    | Left joystick    | WASD / Arrow keys   |
| Depth   | Joystick up/down | W/S or Up/Down      |
| Hit     | HIT button       | J                   |
| Special | SP button        | K                   |
| Jump    | ▲ button         | Space / L           |
| Defend  | DEF button       | Left Shift (hold)   |

## Build for mobile

```bash
npm run build            # web build into dist/
npm run ios:add          # first time only
npm run android:add      # first time only
npm run build:ios        # build + cap sync ios  -> npm run ios:open
npm run build:android    # build + cap sync android -> npm run android:open
```

Then open the native project in Xcode / Android Studio to run on a device or
simulator. Orientation is locked to **landscape** for gameplay.

## Real sprite art (characters, portraits, arenas)

Fighters render from **sprite sheets** when available, and fall back to the
procedural rig otherwise. The same character portraits (select screen + HUD) are
cropped straight from the sheet.

### The 8-fighter roster atlas

The bundled roster lives in `public/sprites/roster.png` (+ `roster.frames.json`)
and is built from an AI-generated character contact sheet in two steps:

```bash
# 1. Strip the fake "checkerboard transparency" (or a flat bg) to real alpha:
node scripts/prep-sheet.mjs art-src/gem1.png art-src/gem1_clean.png checker

# 2. Grid-extract one clean pose per action (idle / idleBack / punch / kick / jump).
#    Each cell keeps only its largest blob, so column labels are ignored.
node scripts/grid-extract.mjs art-src/gem1_clean.png public/sprites/roster
```

`roster.frames.json` holds every frame box plus a `chars` map
(`{ darryl: { idle:[..], punch:[..], ... }, ... }`). `src/game/sprites.js` loads the
shared atlas once and registers every character from that map, so a fighter's
`id` in `src/game/characters.js` just has to match a key in `chars`.

> AI image generators paint a checkerboard instead of emitting real transparency
> and bake in text labels — `prep-sheet` + `grid-extract` are the bridge that turns
> those contact sheets into game-ready transparent frames.

### Add another standalone character sheet

Drop `<name>.png` into `public/sprites/`, auto-slice with `npm run slice
public/sprites/<name>.png`, open `http://localhost:5174/sprites/preview.html` to
read each frame index, then add a `SPRITE_DEFS` entry in `src/game/sprites.js`.

### Real arena backgrounds

Give an arena a `bg` in `src/game/arenas.js` (e.g. `bg: 'arenas/forest.jpg'`), drop
the image in `public/arenas/`, and it replaces the drawn scene automatically.

> ⚠️ **Asset licensing:** the bundled roster art is AI-generated placeholder
> material for prototyping. Ship only artwork you own or have a license for.

## Multiplayer

The lobby layer lives in `src/services/MultiplayerService.js`:

- A **host** creates a room → a random **6-digit invite code** is generated with a
  **90-second expiry** (the timer resets whenever a new player joins).
- **Guests** join by entering the code. The roster, ready-up state and character
  selection sync across everyone in the room.
- Networking is behind a pluggable **transport**:
  - The bundled `BroadcastChannelTransport` connects tabs/windows on the **same
    device** — enough to demo the full invite → lobby → start flow locally.
  - For true **cross-device** play, drop in the included `WebSocketTransport`
    pointed at a tiny relay server that echoes JSON messages by `room`. No game
    logic is needed on the server; live input/state sync flows through
    `MultiplayerService.sendState()` and the `state` event.

```js
import { MultiplayerService, WebSocketTransport } from './services/MultiplayerService.js';
const mp = new MultiplayerService(new WebSocketTransport('wss://your-relay'));
```

## Project layout

```
src/
  main.js                bootstrap + native shell (StatusBar / orientation)
  app/App.js             screens: menu, fighter select, HUD, lobby, settings
  game/
    GameEngine.js        world, physics, combat, specials, depth rendering
    Fighter.js           entity: state machine, combat, procedural art
    characters.js        roster definitions & specials
    ai.js                CPU brain (difficulty-scaled)
    input.js             Controller + touch/keyboard binding
    Projectile.js        projectile specials
    effects.js           particles + floating combat text
    constants.js         physics / difficulty / mode tuning
  services/
    StorageService.js    Capacitor Preferences (local, offline)
    AudioService.js      WebAudio SFX + music
    HapticsService.js    haptics / vibration
    MultiplayerService.js invite-code lobby + transports
```

All progress and settings are stored **locally on device** (no account needed).
