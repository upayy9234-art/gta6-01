[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solstice Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank · gta6-01](https://make.fun/badge/gta6-01-rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward · gta6-01](https://make.fun/badge/gta6-01-reward.svg)](https://make.fun/bounty/gta6-01)

**Solstice Heat — Round 12: living city, weather, races, heists.**

A pastel art-deco beach-city sandbox that runs entirely as static files in
the browser. No build step, no network requests: procedural city,
procedural radio, synthesized engine and siren sounds, and a full
simulation of traffic, pedestrians, police and weather.

## The city

Solstice Bay is generated from a fixed seed: a road grid with named
streets, seven districts (Boardwalk, Downtown, Neon Mile, Marina,
Portside, Old Town, The Hills), lit art-deco towers, palm trees, a sandy
beach, animated ocean, the Marina Pier, glowing billboards, street lamps
and beach props.

## What is new in Round 12

- **Dynamic weather and a full day/night cycle** — the sun and moon cross
  the sky, dawn and golden hour tint the whole city, and clear, breeze,
  overcast, rain, storm and fog states roll in with rain particles,
  lightning, thunder and wet, slippery roads.
- **Street races** — three checkpoint routes (Boardwalk Sprint, Downtown
  Circuit, Bay Grand Tour) against three AI rivals with light
  rubber-banding, live positions and position prizes.
- **Activities everywhere** — 30 hidden glowing shells, 8 stunt ramps with
  slow-motion judged jumps, 6 postcard photo spots and a roaming
  time-trial beacon.
- **Procedural radio** — two stations: a synthesized synth sequencer and a
  news station with a scrolling local ticker.

## Core game

- Play a fixer in a Hawaiian shirt: walk, run, swim, melee, pistol.
- Steal and drive any car: arcade physics, drift, damage and smoke.
- SBPD wanted system, 0–5 stars: patrols, pursuit AI, roadblocks at three
  stars, and a helicopter with a spotlight at four stars and up. A bust
  meter fills when a unit is close and you are slow; break line of sight
  to cool the heat down.
- **Ten-mission story chain** for Marisol Vega with dialogue, go-to,
  tailing, delivery, escort and survive objectives, ending with the crown
  case delivered to Marina Pier at golden hour.
- **Side jobs** from the city job board: taxi fares, courier runs,
  checkpoint rush, VIP rides, tow jobs and paramedic runs.
- **Economy**: cash and bank, a five-rank reputation ladder (Street Rat to
  Solstice Legend) with XP, session statistics, a shop (tires, armor,
  medkits, shirts, resprays, ammo) and food that heals.
- **Living HUD**: cash/bank/rank/XP, wanted stars, health, speedometer,
  objective with distance and timer, police chatter, reward popups,
  tutorial prompts and a live minimap showing roads, traffic, police,
  objectives, shells and the beacon.
- Progress (money, rank, shells, postcards, missions, position) saves to
  localStorage automatically.
- Start, pause, busted and wasted screens; guided three-step onboarding.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Shift | Run |
| E | Enter/exit car, talk, interact |
| F | Melee |
| Mouse click | Fire pistol |
| Space | Brake / handbrake drift |
| 1–4 | Take a job at the job board / start a race at the race office |
| B | Start a race when in a car near the race office |
| X | Cancel the current job |
| R | Switch radio station |
| M | Mute |
| Esc | Pause |

## Screenshots

Deterministic screenshot modes are built in, for example
`http://localhost:8080/?shot=cover&seed=7`. See `shots.json` for the
captured set: cover, drive, chase and foot compositions.

## Structure

- `game/index.html` — page, HUD DOM and styles
- `game/src/config.js` — all tuning: districts, palettes, cars, prices, ranks
- `game/src/rng.js` — seeded mulberry32 RNG and math helpers
- `game/src/audio.js` — procedural WebAudio: engine, sirens, music, ambience
- `game/src/city.js` — procedural city generation and collision
- `game/src/weather.js` — day/night cycle and dynamic weather
- `game/src/vehicles.js` — car models, traffic AI, driving physics
- `game/src/people.js` — pedestrians
- `game/src/player.js` — the player character
- `game/src/police.js` — wanted system, pursuits, roadblocks, helicopter
- `game/src/missions.js` — the ten-mission Marisol Vega story chain
- `game/src/economy.js` — cash, bank, XP, shop and saving
- `game/src/jobs.js` — side jobs
- `game/src/races.js` — street races and stunt jumps
- `game/src/activities.js` — shells, postcards and the beacon trial
- `game/src/hud.js` — HUD and minimap
- `game/src/shots.js` — deterministic screenshot compositions
- `game/src/main.js` — bootstrap, cameras, input and the game loop
- `main.ts` — make.fun submission dossier plumbing
- `serve.ts` — local static server on port 8080
