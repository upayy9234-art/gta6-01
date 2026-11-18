# Neon Harbor — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/upayy9234-art/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built for make.fun's **“Make GTA 6”** bounty ($1,666 in USDC).
Explore the neon harbour city of **Virelia** on foot or by car, steal cars, outrun the VPD police
and their helicopter, finish **twelve story missions across three days** for fixer Mara Voss,
tune your ride at the Virelia Motors garage, shop for ammo and food, listen to Virelia radio,
and take the Harbor Vault heist finale.

**Kai Mercer. Twelve jobs. Three days. A city that remembers.**

## Features

- **A living city, even before you press start** — the title screen is an attract mode: traffic
  drives, VPD patrol cars cruise the boulevard, pedestrians stroll the sidewalks and the beach,
  neon signs flicker, and the radio ticker turns, all with no input at all.
- **Golden-hour sunset as the default look** — the game opens at 18:05, sun low over the harbour:
  warm orange light, long shadows stretching east, lit windows, glowing neon. The night palette
  stays for the later hours as the clock keeps turning.
- **A denser city** — a palm-lined boulevard and sandy beach with rolling waves on the east coast,
  beachfront buildings, named shops and hotels with painted signs (HOTEL BRISA, AZURA BANK,
  SURF SHACK, NEON GYM…), a named label for every district (NEON STRIP, PORTSIDE DOCKS,
  HARBOR PARK, OLD TOWN, PALM BOULEVARD, EAST PIER, HARBOR VAULT, UPTOWN), more traffic,
  parked cars you can steal for free, and pedestrians on the sidewalks and the sand.
- **12 missions · 3 days** — Day 1: the last parcel, the informant Dario, the first Harbor Vault
  score. Day 2: the Neon Strip casino, the Portside docks crates, the last stand against the
  whole VPD. Day 3: the crew gathers, the inside man, the vault codes at Azura Bank, the timed
  getaway route, the Harbor Vault heist, and the final score with the heli on your tail. The
  HUD always shows “MISSION n/12 · DAY n” plus stage progress (“STAGE 2/3”).
- **Radio** — three stations (VNL 88.5 Virelia Nights Live, WAVE 101.2 Harbor FM, VPD 7 police
  dispatch) with named tracks and a ticker in the HUD that cycles between songs and VPD
  dispatch lines. Press R to change station; the bassline follows the dial.
- **Shops** — press E near Harbor Arms (ammo), Pier 9 Diner (food that heals) or Neon Mart
  (snacks + ammo) to open the shop panel; press 1–3 to buy. Cash goes down, ammo and health
  go up, right away.
- **Save / continue** — every finished mission saves to localStorage, and the title screen
  shows “CONTINUE — DAY n · MISSION m/12” when a save exists. Progress resumes where you
  left it, garage and guns included.
- **On foot and by car** — walk, run, aim with the mouse, shoot; press E to steal any car and
  drive it with arcade physics (acceleration, steering, crashes, handbrake).
- **Traffic and pedestrians** — NPC cars cruise the roads and turn at intersections; pedestrians
  stroll the sidewalks and scatter when a car barrels at them.
- **Wanted level + police** — 1–5 stars; patrol cars chase, ram and shoot, more of them as the
  heat rises. At wanted 4 a **police helicopter** joins the hunt, hovering over you with a
  sweeping spotlight and firing from the air at wanted 5. Lay low and out of sight to cool
  off — and hiding with no heat slowly restores your health.
- **VPD roadblocks + lockdown** — at wanted 3+ the VPD seals the road ahead of you: two
  parked interceptors across the road, three cones on the approach and a spike strip in the
  middle (12 damage + most of your speed gone when you roll over it). Smash the interceptors
  or turn around — the block stands down when the heat drops below 3. At wanted 5 the city
  locks down: chasers drive +40 faster and a **second helicopter** joins the hunt. The HUD
  warns “⚠ ROADBLOCK AHEAD — 320m” and the minimap marks every seal in red.
- **Dynamic weather** — the sky runs a CLEAR / RAIN / FOG / STORM state machine, a new spell
  every ~90–150 seconds and never the same twice in a row. Rain and storm make the roads
  slick (grip down, longer stops, traffic slows), fog cuts visibility, storms flash lightning
  and rumble thunder. The sun, sky, lamps and sea all read the weather, and finishing a
  mission in rain pays +50 score, in a storm +100. The HUD shows the weather with an icon.
- **Taxi fares + postcards** — 2–3 passengers wait on the roadside with a gold “$” over their
  heads; press E to pick one up and drop them off before the timer runs out for $150–$400.
  Fares done back to back build a streak bonus (+$50 per streak, up to +$200), and one
  passenger in four is a VIP who pays double against a tighter clock. Ten postcards hide at
  fixed landmarks (Palm Boulevard, Harbor Park, East Pier, Neon Strip, the docks…) — $150 +
  score each, and all ten pay a $1,000 POSTCARD HUNTER bonus. The HUD shows “POSTCARDS n/10”
  and a side-income panel (fares, failures, streak, total side cash); both save with the game.
- **Neon Strip casino district** — a purple-and-gold casino landmark in the north-west of the
  city, with its own neon sign, gold trim and a gold marker on the minimap.
- **Combat and weapons** — shooting on foot, ramming in cars, car explosions, police return fire.
  Four guns to find and switch between (keys 1–4): pistol, Street Sweeper SMG, Harbor Scattergun
  and Long Pier Rifle, each with its own damage, fire rate, spread and ammo. Weapon pickups are
  hidden on roads, in Harbor Park and on the Portside quay; Harbor Arms sells extra ammo.
- **Virelia Motors garage** — drive to the garage on the north road, press G, and spend cash on
  engine (+12% top speed per level), armor (+60 car health per level) and nitro (hold Shift while
  driving for a boost), plus six paint jobs.
- **Portside docks district** — a working harbour in the south-east: container stacks, a rust-red
  warehouse, gantry cranes with blinking beacons, and boats bobbing at the moorings.
- **Day/night cycle** — a real clock: dawn, day, golden hour, dusk and night, with a moving sun,
  twinkling stars, a moon, lamps that glow brighter after dark, and a day counter that ticks
  over past midnight.
- **HUD + minimap** — cash, score, health, wanted stars, mission objective with stage progress,
  radio ticker, shop hints, live clock, minimap with roads, waypoint, police dots, heli dots,
  shop markers and the player arrow.
- **Start, pause, busted and win screens** — plus autosave to localStorage (progress resumes).
- **Polish** — particles (explosions, muzzle flashes), procedural WebAudio sound effects and a
  bassline that plays while driving (M to mute), camera that zooms out while driving.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move on foot / drive |
| Mouse | Aim (on foot) |
| Click / Space | Shoot (on foot) / handbrake (in car) |
| E | Enter / exit car · open a shop when one is near · close a shop panel · pick up a waiting taxi passenger |
| H | Honk the horn (in a car) |
| G | Open / close the Virelia Motors garage (near the garage) |
| R | Change the radio station |
| 1–4 | Switch weapon (pistol / SMG / scattergun / rifle) |
| 1–3 | Buy in a shop while its panel is open |
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
| `screenshots/1-start.jpg` | Title screen — “12 MISSIONS · 3 DAYS · A CITY THAT REMEMBERS” over the living golden-hour city: traffic, patrol cars, pedestrians, palms and the beach behind the logo. |
| `screenshots/2-play.jpg` | Golden-hour street action — Kai driving east past Virelia Motors with the Street Sweeper SMG, a gold taxi passenger waiting at the kerb, the Virelia Motors postcard by the garage, dense traffic, pedestrians, named signs and the radio ticker on screen. |
| `screenshots/3-chase.jpg` | Police chase in the rain — VPD patrol cars, a roadblock with spike strip sealing the road ahead and two police helicopters closing in at wanted level 5, Kai in a nitro-fitted car with engine Lv2 and the Long Pier Rifle. |
| `screenshots/4-win.jpg` | Victory screen — all twelve jobs done across three days, the Harbor Vault heist and the final score banked, garage fully upgraded and every gun owned, with all 10/10 postcards and 14 fares on the win screen's side tally. |

Every shot is reproducible: open the game with `?shot=start|play|chase|win&seed=1` and the same
seeded scene renders every time, so each screenshot above matches exactly what you see in the browser.

## Tech

Vanilla ES modules, canvas 2D. Source is split by responsibility under `game/src/`:
`config.js` (tuning + story + shops + radio), `world.js` (city generation, palms, parked cars),
`coast.js` (east coast: beach, ocean, boulevard), `district.js` (Portside docks + district labels),
`daynight.js` (day/night cycle, golden hour, sun, moon, stars), `missions.js` (missions 1–4),
`missions2.js` (missions 5–6), `missions3.js` (missions 7–12, Day 3 heist finale),
`radio.js` (stations + ticker), `shops.js` (Harbor Arms, Pier 9 Diner, Neon Mart),
`weapons.js` (four guns, ammo, pickups), `garage.js` (Virelia Motors upgrades + paint),
`player.js`, `traffic.js`, `police.js`, `heli.js` (police helicopter), `render.js`, `hud.js`,
`audio.js`, `input.js`, `shots.js`, `main.js`, `wanted.js` (VPD roadblocks + lockdown),
`weather.js` (dynamic weather), `side.js` (taxi fares + postcards).

Built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC.
All names, characters, city, story, art and music are original.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ermzz861&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
