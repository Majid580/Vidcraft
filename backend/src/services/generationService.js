const fs = require('node:fs');
const path = require('node:path');

const remotionService = require('./remotionService');
const externalApiService = require('./externalApiService');
const {
  buildShotPrompt,
  seedForShot,
  DEFAULT_NEGATIVE_PROMPT,
} = require('./continuityPrompt');

// FR-7: reference-image anchoring (img2img). OFF by default — measured, not
// assumed. Anchoring was live-tested against real Cloudflare credentials
// (2026-08-12) on a three-shot storyboard and lost to prompt+seed continuity
// alone on every axis that matters:
//
//   - It freezes composition, not just palette. A wide, a medium and a
//     close-up all came back as the same full-body standing pose, because
//     img2img inherits the reference's layout. That defeats the entire point
//     of a storyboard. Raising `strength` to buy back compositional freedom
//     destroys the anchoring instead: at 0.95 the subject's jacket changed
//     colour, the setting was lost, and a second person appeared in frame.
//   - It costs resolution. flux-1-schnell returns 1024x1024; the SD v1.5
//     img2img model defaults to 512x512, so anchored shots came back at a
//     quarter of the reference's resolution (now pinned, see
//     providers/cloudflareImage.js, but it was a silent quality cliff).
//   - It costs time: ~6s per anchored shot vs ~2.2s unanchored.
//
// Prompt+seed continuity alone (tiers 1-2) held the subject, wardrobe and
// location steady across all three shots AND produced correctly varying
// framing, including a genuine close-up. Anchoring stays implemented and
// verified because it is a legitimate FR-12 evaluation condition — set
// CONTINUITY_REFERENCE_ANCHORING=true to enable it — but it is not the
// default, because on this provider set it makes the output worse.
const REFERENCE_ANCHORING_ENABLED =
  process.env.CONTINUITY_REFERENCE_ANCHORING === 'true';

// Only Cloudflare exposes an img2img endpoint we can feed a local file to;
// Pollinations' image parameter needs a publicly-fetchable URL (see
// providers/pollinationsImage.js).
const REFERENCE_CAPABLE_PROVIDERS = new Set(['cloudflare']);

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

// Media URLs are always of the shape /media/<bucket>/<filename> — generated
// by us, never user-supplied. Validated anyway before being turned into a
// filesystem read: a stored value is still untrusted input at the point it
// crosses back into path handling, and this keeps `..` out of the join.
const MEDIA_URL_PATTERN = /^\/media\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;

/**
 * Loads the storyboard's reference frame as base64, for img2img conditioning.
 * Returns null (never throws) when there is no reference yet, the URL is not
 * a well-formed media path, or the file has gone missing — a missing anchor
 * degrades continuity, it must not fail the shot.
 */
function loadReferenceImageB64(referenceImageUrl) {
  if (!referenceImageUrl) return null;

  const match = MEDIA_URL_PATTERN.exec(referenceImageUrl);
  if (!match) return null;

  const absolute = path.join(GENERATED_DIR, match[1], match[2]);
  if (!absolute.startsWith(GENERATED_DIR)) return null;

  try {
    return fs.readFileSync(absolute).toString('base64');
  } catch {
    return null;
  }
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

  // FR-7 continuity. Every shot in a storyboard carries an identical
  // world_state preamble, so the subject, environment and palette hold
  // steady while the framing and action clauses vary. Previously this call
  // passed a bare `shot.description`, which is why consecutive shots came
  // back as unrelated images.
  //
  // The seed is per-shot, not per-storyboard: a shared seed also pins the
  // composition, which collapsed every shot into the same framing (see
  // continuityPrompt.js's seedForShot). Continuity comes from the prompt.
  const prompt = buildShotPrompt(shot, worldState);
  const options = {
    seed: seedForShot(storyboardId, shot.shot_id),
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  };

  const referenceImageB64 =
    REFERENCE_ANCHORING_ENABLED && REFERENCE_CAPABLE_PROVIDERS.has(shot.provider)
      ? loadReferenceImageB64(worldState?.reference_image_url)
      : null;

  let result;
  try {
    result = await externalApiService.generateByProvider(shot.provider, prompt, {
      ...options,
      ...(referenceImageB64 ? { referenceImageB64 } : {}),
    });
  } catch (err) {
    // Anchoring runs on a different model than the unanchored path
    // (SD v1.5 img2img vs FLUX), so it has its own failure surface: model
    // unavailable, reference rejected, payload too large. Retry once without
    // the reference rather than failing the shot — this is a downgrade of
    // *technique* within the provider the user chose, not the silent
    // cross-provider substitution externalApiService.js rules out.
    if (!referenceImageB64) throw err;
    result = await externalApiService.generateByProvider(shot.provider, prompt, options);
  }

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

module.exports = {
  generateShotAsset,
  generateSingleImage,
  loadReferenceImageB64,
  GENERATED_DIR,
  REFERENCE_ANCHORING_ENABLED,
  REFERENCE_CAPABLE_PROVIDERS,
};
