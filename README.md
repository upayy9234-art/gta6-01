# Solstice Heat: Neon Tide

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in **Solstice Bay**, a sun-soaked coastal city
with a bay, a marina and a lighthouse island across a causeway. You are **Jax
Marlowe**, a wheelman working for fixer **Marisol Vega**: a twelve-mission story
campaign by road and by sea, with live traffic, pedestrians, a full wanted system,
taxi and boat-courier side jobs, a street race, collectibles and a day that turns
from gold to neon. Everything is hand-written JavaScript on one canvas — no engine,
no assets, no network calls; even the sounds are synthesised WebAudio.

Round 14b of the entry: a ground-up rebuild of the earlier Solstice Heat rounds as a
top-down open world — a bigger bay (8 districts, a curved shoreline, three marina
piers, the causeway and Lighthouse Isle), drivable boats alongside nine car models,
and the campaign extended with an escort, a tail, a five-star survival job and the
two-stage Neon Tide finale.

## How to run

- Play: open `game/index.html` in desktop Chrome, or serve it: `node serve.ts` then
  visit http://localhost:8080
- Hand in (dossier): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — copies
  `game/` and `screenshots/` to the output dir and writes `dossier.json` via the
  vendored `buildDossier`.

## What's in the bay

- **The city** — an avenue grid with a working traffic graph across 8 districts
  (Old Town, Palm Heights, University, Neon Mile, Casino Row, The Port, Boardwalk,
  The Marina), pocket parks, parking lots full of stealable cars, a curved beach
  shoreline, three marina piers, a causeway bridge and Lighthouse Isle with its
  turning light.
- **Vehicles** — 8 civilian models plus the SBPD Interceptor and two boats (the
  Tide Runner speedboat and a Harbour Skiff). Arcade driving with drift, handbrake
  skids, collision damage, smoke and fire; traffic that follows the road network,
  brakes for obstacles and panics at gunfire; boats with wake and spray that beach
  on the sand.
- **On foot** — walk, sprint and swim; fists and a pistol with mouse aim;
  pedestrians who stroll, chat, flee and dive out of the road.
- **Police** — heat that only fully counts when a crime is witnessed, 0–5 stars,
  pursuit interceptors that ram and box you, roadblocks from three stars, foot
  officers from three, gunfire from four, a bust meter, heat decay when you break
  sight, and WASTED / BUSTED endings with fines and impounds.
- **Story** — 12 missions for Marisol Vega: thefts, deliveries against the clock, a
  pistol pickup and three lookouts to clear, a forced-heat delivery, a boat run, a
  tail, a convoy escort under attack, the island drop, a checkpoint street race, a
  90-second five-star survival, a roadblocked truck heist, and the two-stage finale.
- **Side work & economy** — taxi fares (paid by distance, tipped for an unbent
  car), boat-courier runs, 25 collectible seashells, dropped pickups (health,
  armour, ammo, cash, a quiet word that cools the heat), a garage that wipes heat
  and repairs, a clinic, and an armoury. Cash and standing save to localStorage.
- **World life** — a full day/night cycle (golden hour, lit windows, neon signs,
  street lamps, headlights, the lighthouse beam), weather that turns clear, hazy,
  rainy or stormy with lightning, skid marks that linger, particles for sparks,
  smoke, fire and spray, camera shake, and a GPS minimap with police blips and the
  objective route.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| E | Steal / enter / exit a vehicle, use a shop, take a job |
| Mouse | Aim |
| Click / F | Punch or shoot |
| Q | Fists / pistol |
| Space | Handbrake |
| P / Esc | Pause |
| M | Sound on/off |
| H | Help (on the title and pause screens) |

## Layout

- `main.ts` — the hand-in program (copies the game, builds the dossier).
- `serve.ts` — a tiny local static server for playing.
- `game/index.html` — the page; `game/src/` holds the game, one job per file:
  `config` (tuning), `random` (seeded RNG + geometry), `input`, `audio` (synth
  SFX), `city` (the bay itself), `vehicles` (driving + traffic), `pedestrians`,
  `police` (wanted + pursuit), `player`, `missions` (the 12-job campaign),
  `sidejobs` (taxi + courier), `effects` (particles, skids, floating text),
  `render` (the world painter), `hud` (HUD, minimap, menus), `shots` (the four
  screenshot scenes) and `main` (boot, screens, the loop).
- `screenshots/` — four real renders of the game, staged by `game/src/shots.js`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
