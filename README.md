# Solstice Heat: Neon Tide

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in **Solstice Bay**, a sun-soaked procedural coastal city. You are **Jax Marlowe**, a wheelman working for fixer **Marisol Vega**: twelve story missions across eight districts, by road and by sea, with traffic, pedestrians, a full wanted system, side jobs, street races, stunt jumps and collectibles — all in one static web page (three.js vendored, everything else hand-written, no network calls).

## How to run

- Play: open `game/index.html` in desktop Chrome, or serve it: `node serve.ts` then visit http://localhost:8080
- Hand in (dossier): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — copies `game/` and `screenshots/` to the output dir and writes `dossier.json` via the vendored `buildDossier`.

## Features

- **Procedural city** — road grid with a traffic/GPS node network, 8 districts (Boardwalk, Neon Mile, Marina, Old Town, Palm Heights, Port, University, Casino Row) with distinct palettes, beach + sea, and an island with a rotating lighthouse joined by a bridge.
- **Vehicles** — 6 civilian models plus police interceptor, taxi and a drivable speedboat (buoyancy, wake, water-only); driving physics with drift, collision damage, smoke and fire; traffic AI that follows the road network and brakes for obstacles; parked cars to steal.
- **On foot** — walk/sprint/swim, third-person camera, melee and pistol combat with hit reactions, pedestrians who wander and flee.
- **Police** — wanted 0–5 stars, pursuit AI that rams and boxes you, roadblocks from 3 stars, a searchlight helicopter from 4 stars, bust meter, heat decay out of sight, WASTED/BUSTED outcomes.
- **Story** — 12 missions for Marisol Vega (goto, chase, tail, escort, survive, deliver, race objectives) plus a 3-step guided onboarding, dialogue subtitles and GPS routing.
- **Side content** — taxi, courier, paramedic, tow, VIP escort, boat courier and checkpoint jobs; 4 street-race routes vs 3 rivals; 10 stunt jumps with slow motion; 40 seashells and 8 postcards to collect; a beacon time trial.
- **Economy** — cash, XP with 5 ranks, shops (armour, clinic, garage, ammo), achievements, localStorage save/continue.
- **World life** — full day/night cycle, sun/moon, weather states (clear, haze, rain, storm, fog) with rain particles and wet roads, windows that light up at night, WebAudio synth engine/sirens/radio (3 procedural stations), particle effects, skid marks, camera shake and a photo mode.

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrows | Move / drive |
| Shift | Sprint |
| Space | Handbrake / drift |
| E | Enter/exit car, accept jobs, talk, shop |
| F or mouse click | Melee / fire pistol |
| R | Reset car |
| M | Radio station |
| P | Photo mode |
| Esc | Pause |

## Project layout

- `game/index.html` — page shell, HUD DOM, styles, script load order
- `game/src/` — one classic script per system on the shared `window.SH` namespace: `config`, `random`, `input`, `audio`, `city`, `buildings`, `vehicles`, `pedestrians`, `player`, `police`, `missions`, `sidejobs`, `economy`, `weather`, `hud`, `effects`, `shots`, `main`
- `game/vendor/three.min.js` — vendored three.js r128 (MIT)
- `screenshots/` — four 1280×720 JPEGs captured from deterministic `?shot=` compositions (see `shots.json`)
- `main.ts` — entry program that builds the dossier; `serve.ts` — local static server; `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`. three.js is vendored under its own MIT license. All names, characters, vehicles, music and art in the game are original to this entry.
