// main.ts — hands Solstice Heat: Neon Tide in to make.fun.
// Copies game/ and screenshots/ into the output directory and writes the
// dossier with the kit's own library, so the bytes the scorer rebuilds are
// the bytes this program wrote. Runs on Node 22 with the standard library
// only, twice in a row, and both runs write the same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The caps the gate scores with; passing them here makes this program fail
// in exactly the places the scorer would refuse the entry.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  for (const part of ['game', 'screenshots']) {
    const from = join(repoRoot, part);
    if (!existsSync(from)) throw new Error('missing ' + part + '/ in the repository');
  }
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outputDir, GATE_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  // buildDossier returns raw bytes (a Uint8Array), so decode before parsing.
  const summary = JSON.parse(new TextDecoder().decode(dossier));
  const images = summary.images ? Object.keys(summary.images).length : 0;
  console.log('dossier written: ' + images + ' screenshots, '
    + dossier.length + ' bytes');
}

handIn();
