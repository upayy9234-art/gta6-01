# Solstice Heat: Neon Tide

An original open-world crime game for the browser, built for the make.fun
**gta6-01** bounty. No engine, no build step, no network: plain ES modules
and one canvas.

Welcome to **Solstice Bay** — 4800×3600 units of sun-baked avenues, a neon
mile, working docks, a marina with three piers, and Lighthouse Isle across
the water on its own causeway. You are **Jax Marlin**, and you owe the bay
money. **Marisol Vega** holds the note, and she has twelve jobs that will
clear it.

## Play it

```sh
node serve.ts            # then open http://localhost:8080
```

or serve `game/` with any static file server and open `game/index.html`.

**Controls** — WASD/arrows walk and drive · **E** enter/exit a vehicle ·
**Space** handbrake · **Shift** sprint · mouse aims, click or **F** fights ·
**P** pause · **M** mute.

## What's in the bay

- **A full wanted system.** Crime raises heat; heat becomes one to five
  stars; stars bring SBPD interceptors, foot officers, roadblocks at three
  stars and gunfire at four. Break line of sight and stay hidden to cool
  down — or fill the bust meter by standing still in front of a cruiser.
- **Twelve missions** for Marisol Vega: car theft and delivery, a timed
  medical run, a dock shootout, holding two stars on purpose, a buoy
  course by boat, a tail job, a convoy escort with an ambush, an island
  drop, the eight-checkpoint **Pink Slip** street race, surviving ninety
  seconds at five stars, a truck heist, and the two-stage **Neon Tide**
  finale.
- **Side work that never runs out**: fares in a Solstice Cab (tips for a
  clean, quick ride) and boat-courier runs between the piers and the
  island.
- **Nine cars and two boats** on one arcade physics model — drift on the
  handbrake, leave skid marks, beach the boat, drown the coupe.
- **A living city**: traffic that follows the road graph and brakes for
  you, pedestrians who stroll, panic and dive, 25 collectible seashells, a
  garage that repairs, a clinic that heals, an armoury that sells the
  Harbor 9mm, vests and rounds.
- **Day, night and weather**: a full day/night cycle with golden hours,
  neon-lit windows and headlight cones after dark, drifting haze, rain and
  thunderstorms — plus a lighthouse whose beam sweeps the bay.
- **Sound, synthesised**: every effect and the title music are WebAudio —
  there are no audio files.
- **Saving**: progress (cash, missions, shells, the clock) persists in
  `localStorage`. Wasted or busted, you wake at the clinic lighter of cash
  but free to go.

## Layout

```
main.ts            the hand-in program: copies game/ + screenshots/ out and
                   writes dossier.json with the vendored library
serve.ts           a small static server for local play
game/index.html    the page — one canvas, one module script
game/src/
  main.js          boot, the loop, states, collisions, services, saving
  city.js          Solstice Bay itself: coast, grid, road graph + BFS
  render.js        the canvas painter: world, lights, weather
  hud.js           HUD, GPS minimap, title/pause/end screens
  vehicles.js      arcade car/boat physics and traffic AI
  police.js        heat, stars, pursuit, roadblocks, busts
  player.js        Jax on foot and behind the wheel; combat; shells
  missions.js      Marisol's twelve jobs and their stage interpreter
  sidejobs.js      taxi fares and boat-courier runs
  pedestrians.js   the strolling, panicking population
  effects.js       particles, skid marks, sky palette, weather
  audio.js         the WebAudio synth: effects, engine, siren, music
  input.js         keyboard and mouse state
  config.js        every tunable number and name
  random.js        seeded RNG and small math helpers
  shots.js         the staged scenes behind screenshots/
vendor/            the kit's makefun-game.ts, unchanged
screenshots/       four real renders of the game, cover first
```

Everything in the game — city, names, story, art, sound — is original to
this entry.
