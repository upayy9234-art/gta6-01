// Solstice Heat: Neon Tide — entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file to the
// output directory (MAKEFUN_OUTPUT_DIR, or /output in the grader) and writes
// dossier.json there with buildDossier from the vendored make.fun library,
// exactly matching the kit's plumbing contract. The game itself is plain static
// files under game/ — open game/index.html in desktop Chrome, no build step.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output tree: game first, then screenshots, then the dossier that
// describes exactly those bytes.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Scorer caps mirrored from the kit so a bad tree fails here, not at the gate:
// 4 screenshots max at 256 KiB each, 993 game entries, 48 MiB of game files,
// 1000-byte path cap, and the judge's 160 KiB source-text window.
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

console.log('Solstice Heat: Neon Tide dossier written to ' + out);
