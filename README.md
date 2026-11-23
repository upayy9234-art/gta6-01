# Solstice Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solstice Heat** is a browser-based open-world action game set in Solstice Bay, a
sun-drenched procedural coastal city of art-deco towers, palm-lined boardwalks,
neon avenues and a working marina. You play a wheelman-for-hire who takes on a
ten-mission story campaign for fixer Marisol Vega while juggling side jobs,
street races, stunt jumps, collectibles and a five-star wanted system.

Everything runs from static files. The 3D world is rendered with the vendored
Three.js build in `game/vendor/`; there are no external dependencies, no build
step for the game itself, and no network calls. Weather, time of day, traffic,
pedestrians, police pressure and the economy are all simulated locally, and
your progress is saved to `localStorage`.

## Running the game

Option one — just open the page:

- Open `game/index.html` in any modern desktop browser.

Option two — serve it locally (recommended, avoids file-origin quirks):

- Run `node serve.ts` from the repository root.
- Visit the printed local address in your browser.

Deterministic screenshot compositions are available through the query string,
for example `game/index.html?shot=cover&seed=7`. The recognised shot names are
`cover`, `drive`, `chase`, `foot`, `marina` and `sunset`.

## Building the dossier

- Run `MAKEFUN_OUTPUT_DIR=out node main.ts` to build the submission dossier.
- The dossier bundles the game, this README, the shot definitions in
  `shots.json` and the screenshots in `screenshots/`.

## Features

- Procedural city of Solstice Bay with seven districts: Boardwalk, Neon Mile,
  Marina, Old Town, Palm Heights, the Port and the University.
- Art-deco buildings with lit windows, palm trees, street lamps, canvas
  billboards, a beach, the sea and the Marina Pier.
- Dynamic weather (clear, haze, rain, storm, fog) and a full day/night cycle
  with moving sun, moon, sky colours and window lights.
- On-foot play: walk, sprint, swim, melee attacks and a pistol, with health
  and armour.
- Drivable cars with acceleration, braking, steering, drift, collision damage
  and deformation smoke, plus AI traffic that follows the road grid.
- Wandering pedestrians who stroll the pavements and flee from danger.
- Police system: wanted level from zero to five stars, pursuit AI, roadblocks
  from three stars, a helicopter spotlight from four stars, a bust meter and
  heat that decays while you stay out of sight.
- Ten-mission story campaign for Marisol Vega with goto, chase, tail, escort
  and survive objectives, preceded by a three-step guided onboarding.
- Six side jobs: taxi, courier, checkpoint run, VIP escort, tow truck and
  paramedic.
- Economy: cash and bank balances, five XP ranks, shops for armour, health,
  ammo and car repairs, all persisted in a local save.
- Three street-race routes with checkpoints and rival cars, plus eight stunt
  jumps with slow-motion cameras.
- Collectibles: thirty seashells and six postcards hidden around the bay, and
  a beacon time-trial mode.
- Procedural WebAudio radio with two stations, engine, siren, weather and UI
  sound effects — no audio files needed.
- Photo mode on the P key with free framing, letterbox bars and a shutter.
- HUD with health, armour, cash, wanted stars, mission text, a live minimap
  drawn on a canvas, and toast notifications.

## Controls

- W / A / S / D or arrow keys — move on foot, drive in a car.
- Shift — sprint on foot.
- Space — handbrake / drift in a car.
- E — enter or exit the nearest car, accept a job or mission prompt.
- F or left mouse button — melee attack or fire the pistol.
- R — reload / reset car upright.
- M — toggle radio station.
- P — photo mode.
- Esc — pause.

## Project layout

- `game/index.html` — page shell, HUD DOM and script load order.
- `game/src/` — the game systems, one classic script per system, all attached
  to the shared `window.SH` namespace.
- `game/vendor/three.min.js` — vendored Three.js renderer.
- `shots.json` — the four dossier screenshot definitions.
- `screenshots/` — the captured dossier screenshots.
- `main.ts` — dossier builder entry point.
- `serve.ts` — tiny local static server for development.

## License

See `LICENSE` in the repository root.
