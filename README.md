[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry in the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

# SOLSTICE HEAT

A complete 3D open-world crime sandbox in the browser, set in **Solstice Bay** — a
fictional tropical beach city caught in a permanent golden hour. You are a fixer in a
Hawaiian shirt working for Marisol Vega: steal cars, run packages, shake off the SBPD,
work taxi fares and side jobs, climb the reputation ladder, and own the bay one glowing
street at a time.

**Round 11** grows the game from a mission chain into a working little economy:
a cash-and-bank wallet, a five-rung reputation ladder that raises every payout,
three kinds of repeatable side jobs with streak bonuses, a guided onboarding tour
for new players, two new story missions, and a layer of game-feel polish (drift
smoke, near-miss bonuses, hurt feedback, police radio chatter, pedestrian barks).

All names, art, music and text are original to this entry. No external assets are used
besides the vendored three.js build; everything else — city, cars, people, sounds — is
generated in code at runtime.

## Running it

```
node serve.ts            # serves game/ on http://localhost:8080
```

Open `http://localhost:8080`, click **NEW GAME** (or press Enter), and play.
A fresh run opens with a short guided tour of contextual hints (skippable with
**Backspace**); the title screen's **HOW TO PLAY** overlay covers controls and the
job system. Progress (cash, bank, reputation XP and stats, mission chain, taxi
license, position) is saved to `localStorage`; **CONTINUE** resumes it, and the
title screen shows the saved run's money, mission, reputation level and bank.

Deterministic screenshot modes are built in for review:
`http://localhost:8080/?shot=cover&seed=7` (also `drive`, `chase`, `foot`).

## The game

- **A living city**: a 6×5 block grid of pastel art-deco buildings with canvas-texture
  windows and neon signs (Hotel Del Sol, Banco Solstice, Palms Casino, Club Sirena…),
  palm trees, street lights, pocket parks, parking lots, six named districts, a sandy
  beach, a wooden pier and a marina on the east shore. The whole layout is generated
  from a fixed seed, so it is identical on every load. Round 11 adds rooftop
  **billboards** with fresh ad copy, warm **festoon string lights** along the
  promenade, and a small fleet of marina **boats that bob on the swell**.
- **Day cycle**: a slow sun loop anchored on golden hour — afternoon melts into sunset,
  a short neon night (windows light up, street lamps and festoon lights glow, car
  headlights switch on), dawn, and back to afternoon. The directional sun casts
  real-time shadows in a tight frustum around the player.
- **Driving**: five car types (sedan, convertible, van, pickup, taxi) with arcade
  physics — speed-sensitive steering, brakes/reverse, building and car-to-car collision
  with visible damage. Any car can be stolen with **E**; traffic drivers bail out and run.
  Hard steering at speed scrubs **drift smoke** from the rear tyres (a capped sprite
  pool, so FPS stays honest), and threading past another car close and fast earns a
  **near-miss bonus** with a floating score popup.
- **Traffic AI**: a dozen cars flow around the grid on right-hand lanes, pick new
  routes at intersections, and brake for cars and pedestrians ahead of them. Parked
  cars line the curbs and lots.
- **Pedestrians**: two dozen low-poly locals stroll the sidewalks, dodge fast cars,
  flee gunfire, and go down when hit (and quietly get recycled by the narrative
  ambulance after a while). They also **talk**: overheard barks react to the moment —
  small talk on a calm street, job-board gossip while you work, panic once the SBPD
  is hunting you.
- **Wanted system**: crimes (car theft, hits, gunfire, ramming police) raise heat;
  heat maps to 0–5 stars. Interceptors spawn at the city edge in proportion to your
  stars, steer a pursuit solution, ram you, and arrest you on foot if they can hold
  you in reach (**BUSTED**). Break line of sight and stay hidden to cool off — the HUD
  eye indicator shows SEEN vs HIDDEN. Health loss ends in **WASTED**. Round 11 gives
  the hunt a voice: star escalations slam a **banner** onto the HUD, **SBPD radio
  chatter** rolls under the music ticker, and the siren audibly sags as a cruiser
  falls behind. Taking damage answers back with a red edge-flash and a camera shake.
- **Story chain — 8 missions** from fixer Marisol Vega, with dialogue toasts, a 3D
  light-pillar marker, minimap blip, and an itemised **reward summary** (payout,
  reputation bonus, banked split, cash in hand) after every completion:
  1. *First Errand* — pick up a package at Marina Pier.
  2. *Hot Wheels* — steal a gold sedan and deliver it to Solstice Motors against the clock.
  3. *Tailspin* — hunt down and ram-stop a fleeing courier coupe.
  4. *Roof Money* — recover three scattered cash cases across downtown.
  5. *Cool Off* — survive three stars and lose the heat completely.
  6. *Final Tide* — lift a case from Banco Solstice and run it to the pier at four stars.
  7. *Night Ledger* — work the new side-job boards: finish any two jobs.
  8. *Solstice Crown* — lift the crown case from The Gilded Palm and deliver it to
     Marina Pier at five stars, against the clock.
- **Economy & reputation**: every payout — missions, fares, jobs — flows through one
  pipeline. 15% is **banked** automatically, the rest lands as cash. Work earns **XP**
  toward five reputation rungs (*Street Rat → Runner → Fixer → Kingpin → Solstice
  Legend*); each rung raises all payouts by 8%. The HUD tracks cash, bank, level and
  XP, and the save keeps lifetime stats: distance driven, jobs and fares completed,
  missions finished, top speed, near misses, total earned.
- **Side jobs**: six glowing green **job boards** around the bay (green squares on the
  minimap). Stand at one and press **J** for a weighted roll of work — a timed
  **courier run**, a **checkpoint rush** through road gates, or a **VIP ride** for a
  named passenger. Payouts scale with distance, reputation and a **streak bonus**
  (+12% per back-to-back completion, capped at +60%) that resets when a job fails.
  A compact job board on the HUD tracks the active job and your streak.
- **Taxi side job**: after mission 2, press **T** behind any wheel — pick up a named
  passenger at the cyan pillar and drop them at a city landmark; fare scales with
  distance, with a speed bonus. Repeatable forever, including after the story ends.
- **Radio + synth audio**: three fictional stations rotate tracks on the HUD ticker,
  while WebAudio synthesizes a tropical synthwave pad loop, a bassline, an engine that
  follows your rpm plus a speed hum that tracks the road, a two-tone siren that swells
  as police close in (and sags as they fall behind), success and level-up stingers, and
  one-shot effects (gunfire, crashes, cash register, doors, footsteps, jingles). **M** mutes.
- **HUD**: cash + bank, reputation level with XP bar, wanted stars (they blink as heat
  rises), health bar, speedometer, mission objective with live distance and countdown
  timer, arrest meter, side-job board, reward summaries, and a 2D minimap with player
  arrow, blinking police blips, mission and taxi markers, a pulsing green job blip and
  permanent job-board squares.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive (camera-relative on foot) |
| Shift | Sprint |
| Space | Jump |
| E | Enter / exit / steal car |
| F | Shoot (on foot) |
| T | Taxi job (while driving) |
| J | Take / abandon side job (at a green job board) |
| Arrow keys | Orbit camera / pitch |
| P or Esc | Pause |
| M | Mute |
| Enter | Start on title screen |
| Backspace | Skip the guided tour |
| R | Respawn after WASTED / BUSTED |

## Architecture

Plain classic scripts (no modules, no build step) loaded in order from
`game/index.html`, each an IIFE attaching to the `window.SH` namespace:

| File | Responsibility |
| --- | --- |
| `game/vendor/three.min.js` | three.js r128 (vendored, MIT) |
| `game/src/config.js` | City grid, palettes, districts, streets, named buildings, locations, mission data, economy + job tuning, radio playlist, chatter and bark lines |
| `game/src/rng.js` | mulberry32 seeded PRNG (incl. weighted picks) + shared math helpers (`SH.U`) |
| `game/src/audio.js` | WebAudio music/engine/siren/SFX synthesis, success + level-up stingers |
| `game/src/economy.js` | Cash/bank wallet, reputation ladder + XP, payout pipeline, lifetime stats, save block |
| `game/src/city.js` | Procedural city build, canvas textures, sky dome, colliders, road/sidewalk queries, day/night material state, billboards, festoon lights, bobbing boats |
| `game/src/vehicles.js` | Car meshes, shared arcade physics, collision events, traffic AI, parked cars, drift smoke, near-miss bonuses |
| `game/src/people.js` | Pedestrian factory/animation, sidewalk AI, flee/down states, contextual barks |
| `game/src/player.js` | Hero controller, third-person camera, car entry/theft, hitscan shooting, health, hurt flash + camera shake |
| `game/src/police.js` | Heat/stars, interceptor spawning, pursuit steering, arrest logic, lightbars, radio chatter, escalation banner |
| `game/src/jobs.js` | Side-job system: job boards, courier / checkpoint-rush / VIP jobs, streaks, green marker |
| `game/src/missions.js` | Mission state machines (8 missions), marker pillar, taxi side job, save data |
| `game/src/hud.js` | DOM HUD (incl. economy panel, job board, reward summary, tutorial hint), toasts/messages, minimap rendering |
| `game/src/shots.js` | Deterministic `?shot=` screenshot compositions |
| `game/src/main.js` | Bootstrap, game loop, state machine, day cycle, input, localStorage save, guided onboarding |

`main.ts` (with `vendor/makefun-game.ts`) is the make.fun plumbing: it copies `game/`
and `screenshots/` to the output directory and writes `dossier.json`.
`serve.ts` is a tiny static file server for local play.

## License

MIT (see `LICENSE`). three.js is © its authors, MIT licensed.
