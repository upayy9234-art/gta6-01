// Solstice Heat: Neon Tide — hand-in program for the make.fun gta6-01 bounty.
//
// The entry itself is a static browser game living in game/ (open
// game/index.html, or serve the folder with `node serve.ts`). This program
// does the hand-in only: it copies game/ and screenshots/ into the output
// directory and writes dossier.json there using the kit's vendored library,
// vendor/makefun-game.ts, untouched. Node 22, standard library only, no
// network. When it runs outside the grader, MAKEFUN_OUTPUT_DIR names the
// output directory instead of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the gate's own, handed to the dossier builder so an entry the
// gate would turn away fails here first, on my machine, not on theirs:
// 160 KiB of dossier text, no more than 4 screenshots of 256 KiB apiece,
// no more than 993 game files or 48 MiB of game, no game path over 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log('Solstice Heat: Neon Tide — game/, screenshots/ and dossier.json written to ' + outputDir);
