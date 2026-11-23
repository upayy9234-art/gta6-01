# Solstice Heat: Neon Tide

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game that runs entirely in the browser, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). No build
step, no dependencies, no network: open `game/index.html` and play.

## The game

Solstice Bay is a sun-soaked coastal city of eight districts, a marina with
three piers, and a causeway out to Lighthouse Isle. You are Jax Marlin,
small-time wheelman, and fixer **Marisol Vega** has twelve jobs for you —
steal-and-deliver runs, a timed package drop, a shootout at the Portside
warehouses, a boat buoy course, a quiet tail, a convoy escort with an
ambush, an island drop, an eight-checkpoint street race, two survival jobs
against a rising wanted level, a vault-truck heist, and a two-stage finale.

Between jobs there is honest work: taxi fares in a Cabrio, boat courier
runs between the piers, and 25 seashells scattered on the sand. The SBPD
watches all of it. Crimes only count when somebody sees them — then heat
becomes stars, and stars bring interceptors, roadblocks, foot officers and,
at four stars, gunfire. Get boxed in and the bust meter fills; lose them in
the back streets and the heat cools off.

## Controls

- **WASD / arrows** — walk and drive
- **E** — enter/exit a vehicle, talk, use a service
- **Mouse + F / click** — aim and fight (fists, then the Harbor 9mm)
- **SPACE** — handbrake · **SHIFT** — sprint
- **ESC / P** — pause (save with S, mute with M)

Eleven vehicles share one arcade physics model — compacts, a muscle car, a
supercar, a taxi, a vault truck, two boats — with drift, handbrake skid
marks, and damage that smokes, burns and wrecks. A full day/night cycle
lights the Neon Mile after dark; weather rolls in off the bay; the engine,
sirens, gunfire and the synthwave bassline are all synthesized live with
WebAudio. Progress saves to localStorage.

## Running it

```sh
node serve.ts          # serves game/ at http://localhost:8080
node main.ts           # writes out/ + dossier.json (MAKEFUN_OUTPUT_DIR=out)
```

## Layout

- `game/index.html` — the page and its inline boot script
- `game/src/` — the game, one module per job: `city` (the procedural bay,
  road graph and BFS routing), `vehicles` (physics + traffic), `police`
  (heat, stars, pursuit, busts), `missions` (the twelve jobs), `sidejobs`
  (taxi, courier, services), `player`, `pedestrians`, `render`, `hud`,
  `audio`, `effects`, `input`, `shots`, `main`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
