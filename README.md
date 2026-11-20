# SOLSTICE HEAT

A complete 3D open-world crime sandbox in the browser, set in **Solstice Bay** — a
fictional tropical beach city caught in a permanent golden hour. You are a fixer in a
Hawaiian shirt working for Marisol Vega: steal cars, run packages, shake off the SBPD,
work taxi fares, and own the bay one glowing street at a time.

All names, art, music and text are original to this entry. No external assets are used
besides the vendored three.js build; everything else — city, cars, people, sounds — is
generated in code at runtime.

## Running it

```
node serve.ts            # serves game/ on http://localhost:8080
```

Open `http://localhost:8080`, click **NEW GAME** (or press Enter), and play.
Progress (money, mission chain, taxi license, position) is saved to `localStorage`;
**CONTINUE** resumes it.

Deterministic screenshot modes are built in for review:
`http://localhost:8080/?shot=cover&seed=7` (also `drive`, `chase`, `foot`).

## The game

- **A living city**: a 6×5 block grid of pastel art-deco buildings with canvas-texture
  windows and neon signs (Hotel Del Sol, Banco Solstice, Palms Casino, Club Sirena…),
  palm trees, street lights, pocket parks, parking lots, six named districts, a sandy
  beach, a wooden pier and a marina on the east shore. The whole layout is generated
  from a fixed seed, so it is identical on every load.
- **Day cycle**: a slow sun loop anchored on golden hour — afternoon melts into sunset,
  a short neon night (windows light up, street lamps glow, car headlights switch on),
  dawn, and back to afternoon. The directional sun casts real-time shadows in a tight
  frustum around the player.
- **Driving**: five car types (sedan, convertible, van, pickup, taxi) with arcade
  physics — speed-sensitive steering, brakes/reverse, building and car-to-car collision
  with visible damage. Any car can be stolen with **E**; traffic drivers bail out and run.
- **Traffic AI**: a dozen cars flow around the grid on right-hand lanes, pick new
  routes at intersections, and brake for cars and pedestrians ahead of them. Parked
  cars line the curbs and lots.
- **Pedestrians**: two dozen low-poly locals stroll the sidewalks, dodge fast cars,
  flee gunfire, and go down when hit (and quietly get recycled by the narrative
  ambulance after a while).
- **Wanted system**: crimes (car theft, hits, gunfire, ramming police) raise heat;
  heat maps to 0–5 stars. Interceptors spawn at the city edge in proportion to your
  stars, steer a pursuit solution, ram you, and arrest you on foot if they can hold
  you in reach (**BUSTED**). Break line of sight and stay hidden to cool off — the HUD
  eye indicator shows SEEN vs HIDDEN. Health loss ends in **WASTED**.
- **Story chain — 6 missions** from fixer Marisol Vega, with dialogue toasts, a 3D
  light-pillar marker and minimap blip:
  1. *First Errand* — pick up a package at Marina Pier.
  2. *Hot Wheels* — steal a gold sedan and deliver it to Solstice Motors against the clock.
  3. *Tailspin* — hunt down and ram-stop a fleeing courier coupe.
  4. *Roof Money* — recover three scattered cash cases across downtown.
  5. *Cool Off* — survive three stars and lose the heat completely.
  6. *Final Tide* — lift a case from Banco Solstice and run it to the pier at four stars.
- **Taxi side job**: after mission 2, press **T** behind any wheel — pick up a named
  passenger at the cyan pillar and drop them at a city landmark; fare scales with
  distance, with a speed bonus. Repeatable forever, including after the story ends.
- **Radio + synth audio**: three fictional stations rotate tracks on the HUD ticker,
  while WebAudio synthesizes a tropical synthwave pad loop, a bassline, an engine that
  follows your rpm, a two-tone siren that swells as police close in, and one-shot
  effects (gunfire, crashes, cash register, doors, footsteps, jingles). **M** mutes.
- **HUD**: money, wanted stars (they blink as heat rises), health bar, speedometer,
  mission objective with live distance and countdown timer, arrest meter, and a 2D
  minimap with player arrow, blinking police blips, mission and taxi markers.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive (camera-relative on foot) |
| Shift | Sprint |
| Space | Jump |
| E | Enter / exit / steal car |
| F | Shoot (on foot) |
| T | Taxi job (while driving) |
| Arrow keys | Orbit camera / pitch |
| P or Esc | Pause |
| M | Mute |
| Enter | Start on title screen |
| R | Respawn after WASTED / BUSTED |

## Architecture

Plain classic scripts (no modules, no build step) loaded in order from
`game/index.html`, each an IIFE attaching to the `window.SH` namespace:

| File | Responsibility |
| --- | --- |
| `game/vendor/three.min.js` | three.js r128 (vendored, MIT) |
| `game/src/config.js` | City grid, palettes, districts, streets, named buildings, locations, mission data, radio playlist, tuning |
| `game/src/rng.js` | mulberry32 seeded PRNG + shared math helpers (`SH.U`) |
| `game/src/audio.js` | WebAudio music/engine/siren/SFX synthesis |
| `game/src/city.js` | Procedural city build, canvas textures, sky dome, colliders, road/sidewalk queries, day/night material state |
| `game/src/vehicles.js` | Car meshes, shared arcade physics, collision events, traffic AI, parked cars |
| `game/src/people.js` | Pedestrian factory/animation, sidewalk AI, flee/down states |
| `game/src/player.js` | Hero controller, third-person camera, car entry/theft, hitscan shooting, health |
| `game/src/police.js` | Heat/stars, interceptor spawning, pursuit steering, arrest logic, lightbars |
| `game/src/missions.js` | Mission state machines, marker pillar, taxi side job, save data |
| `game/src/hud.js` | DOM HUD, toasts/messages, minimap rendering |
| `game/src/shots.js` | Deterministic `?shot=` screenshot compositions |
| `game/src/main.js` | Bootstrap, game loop, state machine, day cycle, input, localStorage save |

`main.ts` (with `vendor/makefun-game.ts`) is the make.fun plumbing: it copies `game/`
and `screenshots/` to the output directory and writes `dossier.json`.
`serve.ts` is a tiny static file server for local play.

## License

MIT (see `LICENSE`). three.js is © its authors, MIT licensed.
