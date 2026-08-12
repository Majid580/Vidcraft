#!/usr/bin/env node
// FR-9 — renders a whole storyboard to a single MP4. Invoked by
// backend/src/services/remotionService.js as a child process, same contract
// as render-shot.mjs (never import this into a browser/Studio context).
//
// Usage: node render-storyboard.mjs <propsJsonPath> <outputPath>
// <propsJsonPath> must contain { "shots": Shot[], "worldState": WorldState },
// where each shot carries an absolute http `imageSrc` pointing at its
// generated still on the backend's /media mount (see remotion/src/types.ts).
//
// The backend must be serving /media while this runs — the headless browser
// fetches each still over http. That holds in the current single-process
// setup, where the generation queue runs inside the API server.

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPOSITION_ID = 'StoryboardVideo';

async function main() {
  const [, , propsPath, outputPath] = process.argv;
  if (!propsPath || !outputPath) {
    console.error('Usage: node render-storyboard.mjs <propsJsonPath> <outputPath>');
    process.exit(1);
  }

  const { shots, worldState } = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
  if (!Array.isArray(shots) || shots.length === 0) {
    console.error('render-storyboard: no shots to render');
    process.exit(1);
  }

  const inputProps = { shots, worldState };

  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, 'src', 'index.ts'),
  });

  // Duration comes from calculateMetadata on the composition (the sum of
  // every shot's duration_s), so it is resolved here rather than assumed.
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: COMPOSITION_ID,
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

  console.log(
    JSON.stringify({
      compositionId: COMPOSITION_ID,
      outputPath,
      shotCount: shots.length,
      durationInFrames: composition.durationInFrames,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
