// SOLSTICE HEAT — a 3D open-world crime sandbox for make.fun gta6-01 (Node 22, standard
// library only): the game is this directory's game/ folder, plain static files a desktop
// browser loads offline (game/index.html plus classic scripts and the vendored three.js
// r128 build under game/vendor/, no network requests), and this program hands it in. It
// copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// The game itself (Round 11): a fixer in a Hawaiian shirt works Marisol Vega's eight-mission
// chain across Solstice Bay, a seeded procedural beach city of pastel art-deco blocks, palms,
// traffic, pedestrians and a 0-5 star police wanted system — steal any car, run taxi fares,
// work the side-job boards (courier runs, checkpoint rushes, VIP rides), climb the five-rung
// reputation ladder from Street Rat to Solstice Legend, lose the heat, and deliver the crown
// case to Marina Pier at golden hour.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ENTRY_TITLE = 'Solstice Heat — Round 12: living city, weather, races, heists and photo mode';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`${ENTRY_TITLE}: game/ + screenshots/ + dossier.json written to ${out}`);
