const fs = require('node:fs');
const path = require('node:path');

const remotionService = require('./remotionService');
const externalApiService = require('./externalApiService');

// Sibling to remotion/out/ and ai-service/rag/data/ — a disposable,
// gitignored directory of derived artifacts, not a source-controlled one.
const GENERATED_DIR = path.join(__dirname, '..', '..', 'generated');

// Per direct team instruction (2026-08-11): image generation (Pollinations,
// Cloudflare — both free tier) proceeds for real now. Video (Hugging Face)
// is deliberately held — its free monthly router credits are already
// depleted (PROVIDER-001/BACKEND-005 finding), and retrying against a
// known-exhausted quota just burns time for a guaranteed failure. This is
// a paused pathway, not a bug: it resumes once the team supplies a paid
// HUGGINGFACE_API_TOKEN with higher limits. Keyed by provider (not
// pathway) so remotion/pollinations/cloudflare are unaffected.
const HELD_PROVIDERS = {
  huggingface:
    'Video generation (Hugging Face) is on hold pending a paid API key with higher limits — ' +
    'the free-tier monthly credits are exhausted. Provide a paid HUGGINGFACE_API_TOKEN to resume this pathway.',
};

function extensionFor(contentType = '') {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('mp4') || contentType.includes('video')) return 'mp4';
  return 'jpg';
}

/**
 * Generates (or renders) the real asset for one shot and returns its
 * public URL under /media. Throws on failure; throws with `.onHold = true`
 * for a deliberately-paused provider (see HELD_PROVIDERS) so callers can
 * distinguish "not attempted" from "attempted and failed".
 */
async function generateShotAsset(storyboardId, shot, worldState) {
  const dir = path.join(GENERATED_DIR, String(storyboardId));
  fs.mkdirSync(dir, { recursive: true });

  if (shot.pathway === 'remotion') {
    const filename = `shot-${shot.shot_id}.mp4`;
    const outputPath = path.join(dir, filename);
    await remotionService.renderShot(shot, worldState, outputPath);
    return `/media/${storyboardId}/${filename}`;
  }

  const heldReason = HELD_PROVIDERS[shot.provider];
  if (heldReason) {
    const err = new Error(heldReason);
    err.onHold = true;
    throw err;
  }

  const result = await externalApiService.generateByProvider(shot.provider, shot.description);
  const filename = `shot-${shot.shot_id}.${extensionFor(result.contentType)}`;
  fs.writeFileSync(path.join(dir, filename), result.buffer);
  return `/media/${storyboardId}/${filename}`;
}

/**
 * Single-image mode (POST /api/images): generates exactly one real image
 * from an already-enhanced prompt, no storyboard/shot decomposition
 * involved. Shares the same provider adapters and output directory as the
 * storyboard path, keyed by promptId instead of storyboardId/shot_id.
 */
async function generateSingleImage(promptId, provider, prompt) {
  const dir = path.join(GENERATED_DIR, 'images');
  fs.mkdirSync(dir, { recursive: true });

  const result = await externalApiService.generateByProvider(provider, prompt);
  const filename = `${promptId}.${extensionFor(result.contentType)}`;
  fs.writeFileSync(path.join(dir, filename), result.buffer);
  return `/media/images/${filename}`;
}

module.exports = { generateShotAsset, generateSingleImage, GENERATED_DIR };
