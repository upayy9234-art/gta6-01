# Neon Harbor — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built for make.fun's **“Make GTA 6”** bounty ($1,666 in USDC).
Explore the neon harbour city of **Virelia** on foot or by car, steal cars, outrun the VPD police
and their helicopter, finish six story missions for fixer Mara Voss, tune your ride at the
Virelia Motors garage, fight back with four guns, and take the Harbor Vault, Neon Strip and
Portside scores.

**Kai Mercer. One last job. A whole city that wants him caught.**

## Features

- **Open city to explore** — a procedural road grid, buildings with lit windows and neon signs,
  Harbor Park, a river with two bridges, street lamps, day/night cycle.
- **On foot and by car** — walk, run, aim with the mouse, shoot; press E to steal any car and drive it
  with arcade physics (acceleration, steering, crashes, handbrake).
- **Traffic and pedestrians** — NPC cars cruise the roads and turn at intersections; pedestrians
  stroll the sidewalks and scatter when a car barrels at them.
- **Wanted level + police** — 1–5 stars; patrol cars chase, ram and shoot, more of them as the heat rises.
  At wanted 4 a **police helicopter** joins the hunt, hovering over you with a spotlight and firing
  from the air at wanted 5. Lay low and out of sight to cool off — and hiding with no heat slowly
  restores your health.
- **Neon Strip casino district** — a purple-and-gold casino landmark in the north-west of the city,
  with its own neon sign, gold trim and a gold marker on the minimap.
- **Missions and story** — six sequential jobs: deliver a parcel to the East Pier, chase down the
  informant Dario's violet coupe, rob the Harbor Vault and escape to the hideout — then hit the
  Neon Strip casino for the biggest score of all, with the helicopter on your tail — then lift
  three crates in the Portside docks, and survive the last stand against the whole VPD. Waypoint
  marker, edge arrow with distance, objective bar and banners.
- **Combat and weapons** — shooting on foot, ramming in cars, car explosions, police return fire.
  Four guns to find and switch between (keys 1–4): pistol, Street Sweeper SMG, Harbor Scattergun
  and Long Pier Rifle, each with its own damage, fire rate, spread and ammo. Weapon pickups are
  hidden on roads, in Harbor Park and on the Portside quay.
- **Virelia Motors garage** — drive to the garage on the north road, press G, and spend cash on
  engine (+12% top speed per level), armor (+60 car health per level) and nitro (hold Shift while
  driving for a boost), plus six paint jobs.
- **Portside docks district** — a working harbour in the south-east: container stacks, a rust-red
  warehouse, gantry cranes with blinking beacons, and boats bobbing at the moorings.
- **Day/night cycle** — a real clock: dawn, day, dusk and night, with a moving sun, twinkling stars,
  a moon, lamps that glow brighter after dark, and a day counter that ticks over past midnight.
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
| H | Honk the horn (in a car) |
| G | Open / close the Virelia Motors garage (near the garage) |
| 1–4 | Switch weapon (pistol / SMG / scattergun / rifle) |
| 1–9 | Buy in the garage (1–3 upgrades, 4–9 paint) while it is open |
| Shift | Run (on foot) / nitro boost (in a car, when fitted) |
| Esc / P | Pause |
| M | Toggle sound |

## Run

Serve `game/` with any static server and open `index.html` in a desktop browser.
No build step, no network requests, no dependencies — vanilla HTML/CSS/JS.

```sh
cd game && python3 -m http.server 8080
# then open http://localhost:8080 in a desktop browser
```

## Screenshots

Four deterministic screenshots live in `screenshots/`, each a 1280x720 JPEG captured from a
fixed scene in the game:

| File | Scene |
|---|---|
| `screenshots/1-start.jpg` | Title screen — the Neon Harbor logo, "Press Enter to start", and the Virelia skyline. |
| `screenshots/2-play.jpg` | Street action — Kai driving east past the Virelia Motors garage with the Street Sweeper SMG equipped, traffic and pedestrians around him. |
| `screenshots/3-chase.jpg` | Police chase — VPD patrol cars and the police helicopter closing in at wanted level 5, Kai in a nitro-fitted car with engine Lv2 and the Long Pier Rifle. |
| `screenshots/4-win.jpg` | Victory screen — all six jobs done, the Harbor Vault, Neon Strip and Portside scores banked, garage fully upgraded and every gun owned. |

Every shot is reproducible: open the game with `?shot=start|play|chase|win&seed=1` and the same
seeded scene renders every time, so each screenshot above matches exactly what you see in the browser.

## Tech

Vanilla ES modules, canvas 2D. Source is split by responsibility under `game/src/`:
`config.js` (tuning + story), `world.js` (city generation), `district.js` (Portside docks),
`daynight.js` (day/night cycle, sun, moon, stars), `weapons.js` (four guns, ammo, pickups),
`garage.js` (Virelia Motors upgrades + paint), `missions2.js` (missions 5–6), `player.js`,
`traffic.js`, `police.js`, `heli.js` (police helicopter), `missions.js`, `render.js`, `hud.js`,
`audio.js`, `input.js`, `shots.js`, `main.js`.

Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.
All names, characters, city, story, art and music are original.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ermzz861&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
