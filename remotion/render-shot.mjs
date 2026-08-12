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
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The taxonomy moved to src/shotTaxonomy.mjs so the StoryboardVideo
// composition can apply the same mapping inside the bundle. Re-exported here
// because REMOTION-003's tests and callers import it from this module.
export { selectCompositionId } from './src/shotTaxonomy.mjs';
import { selectCompositionId } from './src/shotTaxonomy.mjs';

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

// Only run when invoked as a script. Without this guard, importing the module
// for `selectCompositionId` also fires a render and exits the process on
// missing argv — which made the export above unusable from anywhere but the
// CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
