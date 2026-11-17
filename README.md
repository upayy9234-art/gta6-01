# Neon Harbor — Make GTA 6

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty%20gta6--01-ff2e88)](https://make.fun/bounty/gta6-01)
[![reward $1,666 USDC](https://img.shields.io/badge/reward-%241%2C666%20USDC-7CFC9A)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for make.fun's **“Make GTA 6”** bounty ($1,666 in USDC).
Explore the neon harbour city of **Virelia** on foot or by car, steal cars, outrun the VPD police,
finish three story missions for fixer Mara Voss, and take the Harbor Vault score.

**Kai Mercer. One last job. A whole city that wants him caught.**

## Features

- **Open city to explore** — a procedural road grid, buildings with lit windows and neon signs,
  Harbor Park, a river with two bridges, street lamps, day/night cycle.
- **On foot and by car** — walk, run, aim with the mouse, shoot; press E to steal any car and drive it
  with arcade physics (acceleration, steering, crashes, handbrake).
- **Traffic and pedestrians** — NPC cars cruise the roads and turn at intersections; pedestrians
  stroll the sidewalks and scatter when a car barrels at them.
- **Wanted level + police** — 1–5 stars; patrol cars chase, ram and shoot, more of them as the heat rises.
  Lay low and out of sight to cool off.
- **Missions and story** — three sequential jobs: deliver a parcel to the East Pier, chase down the
  informant Dario's violet coupe, then rob the Harbor Vault and escape to the hideout. Waypoint
  marker, edge arrow with distance, objective bar and banners.
- **Combat** — shooting on foot, ramming in cars, car explosions, police return fire.
- **HUD + minimap** — cash, score, health, wanted stars, mission objective, live clock, minimap with
  roads, waypoint, police dots and the player arrow.
- **Start, pause, busted and win screens** — plus autosave to localStorage (progress resumes).
- **Polish** — particles (explosions, muzzle flashes), procedural WebAudio sound effects and a
  bassline that plays while driving (M to mute), camera that zooms out while driving.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move on foot / drive |
| Mouse | Aim (on foot) |
| Click / Space | Shoot (on foot) / handbrake (in car) |
| E | Enter / exit car |
| Shift | Run |
| Esc / P | Pause |
| M | Toggle sound |

## Run

Serve `game/` with any static server and open `index.html` in a desktop browser.
No build step, no network requests, no dependencies — vanilla HTML/CSS/JS.

```sh
# from the repo root, e.g. with the bundled dev server
node serve.ts   # then open http://localhost:8080
```

Screenshot scenes (deterministic): `?shot=start|play|chase|win&seed=1`.

## Tech

Vanilla ES modules, canvas 2D. Source is split by responsibility under `game/src/`:
`config.js` (tuning + story), `world.js` (city generation), `player.js`, `traffic.js`,
`police.js`, `missions.js`, `render.js`, `hud.js`, `audio.js`, `input.js`, `shots.js`, `main.js`.

Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.
All names, characters, city, story, art and music are original.
