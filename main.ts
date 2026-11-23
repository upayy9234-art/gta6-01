// Solstice Heat: Neon Tide — the hand-in program for the gta6-01 bounty.
// The game itself is the static site in game/ (open game/index.html in a browser and
// play; `node serve.ts` serves it locally). This program copies game/ and
// screenshots/ into the output directory and writes dossier.json there with the
// vendored make.fun library, exactly as the bounty asks. Node 22, standard library
// only. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, passed to the dossier builder so an entry the scorer
// would refuse is refused here first: the dossier text cap, at most 4 screenshots
// of at most 256 KiB each, at most 993 game files and 48 MiB of game in all, and
// no game path longer than 1000 bytes.
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

console.log(`Solstice Heat: Neon Tide handed in to ${out} (game/, screenshots/, dossier.json)`);
