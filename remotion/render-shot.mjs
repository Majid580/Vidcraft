#!/usr/bin/env node
// Programmatic render entry point (REMOTION-003). Invoked by
// backend/src/services/remotionService.js as a child process — never
// import this directly into a browser/Studio context.
//
// Usage: node render-shot.mjs <propsJsonPath> <outputPath>
// <propsJsonPath> must contain { "shot": Shot, "worldState": WorldState }
// (see remotion/src/types.ts for the shape).

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition as resolveComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Shot -> composition taxonomy (REMOTION-003, resolves open question R-11) ---
// Keyed on the leading word of shot.camera, matching the composition
// library built in REMOTION-002 (WideShot / MediumShot / CloseUpShot).
// Any shot.camera that doesn't match a recognized shot-type word falls
// back to MediumShot — a documented default, never a thrown error, per
// REMOTION-003's acceptance criteria ("arbitrary shot JSON maps to a
// valid composition or documented default").
export function selectCompositionId(shot) {
  const camera = (shot.camera ?? '').trim().toLowerCase();
  if (camera.startsWith('wide')) return 'WideShot';
  if (camera.startsWith('medium')) return 'MediumShot';
  if (
    camera.startsWith('close-up') ||
    camera.startsWith('close up') ||
    camera.startsWith('closeup')
  ) {
    return 'CloseUpShot';
  }
  return 'MediumShot'; // documented fallback default: the most visually
  // neutral of the three (frames a subject without committing to an
  // establishing wide or an intimate close-up), and reuses an existing
  // composition rather than a purpose-built "unknown shot" template.
}

async function main() {
  const [, , propsPath, outputPath] = process.argv;
  if (!propsPath || !outputPath) {
    console.error('Usage: node render-shot.mjs <propsJsonPath> <outputPath>');
    process.exit(1);
  }

  const { shot, worldState } = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
  const compositionId = selectCompositionId(shot);
  const inputProps = { shot, worldState };

  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, 'src', 'index.ts'),
  });

  const composition = await resolveComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  });

  console.log(JSON.stringify({ compositionId, outputPath }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
