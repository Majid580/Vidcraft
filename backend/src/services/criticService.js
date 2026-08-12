const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const generationService = require('./generationService');
const aiServiceClient = require('./aiServiceClient');

const execFileAsync = promisify(execFile);

const CRITIC_MAX_RETRIES = parseInt(process.env.CRITIC_MAX_RETRIES || '2', 10);

function assetPathFor(storyboardId, assetUrl) {
  // assetUrl looks like /media/<storyboardId>/<filename> (see
  // generationService.generateShotAsset) — reconstruct the real filesystem
  // path under the same disposable GENERATED_DIR.
  const filename = assetUrl.split('/').pop();
  return path.join(generationService.GENERATED_DIR, String(storyboardId), filename);
}

// Remotion shots render to .mp4; image-provider shots (pollinations,
// cloudflare) are already a single frame, so no extraction is needed.
async function extractFrameBase64(absPath) {
  if (!absPath.endsWith('.mp4')) {
    return fs.readFileSync(absPath).toString('base64');
  }

  const framePath = path.join(
    os.tmpdir(),
    `critic-frame-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
  );
  try {
    // First frame is a representative, cheap-to-extract sample of the shot —
    // good enough for the pass/fail quality gate this loop implements.
    await execFileAsync('ffmpeg', ['-y', '-i', absPath, '-vf', 'select=eq(n\\,0)', '-vframes', '1', framePath]);
    return fs.readFileSync(framePath).toString('base64');
  } finally {
    fs.rm(framePath, { force: true }, () => {});
  }
}

/**
 * CRITIC-001 (FR-8): vision-model quality gate with a bounded retry loop.
 * Called after a shot's asset has already been generated successfully.
 * While the verdict is a fail and shot.retry_count is under
 * CRITIC_MAX_RETRIES, regenerates the same shot (same description/camera —
 * the proposal's "Cinematographer revises the shot" step is deliberately
 * deferred, see ADR-026) and re-evaluates. On a pass, or on retry
 * exhaustion, finalizes with the last attempt rather than failing the shot
 * (mirrors AI-008's storyboard-similarity retry-exhaustion behavior).
 *
 * Scope (ADR-026, live-discovered this session): only runs for
 * `pathway === 'external_api'` shots (Pollinations/Cloudflare images).
 * Remotion's guaranteed pathway renders a deliberately abstract, stylized
 * placeholder (dark theme background + a late-fading text caption — see
 * remotion/src/theme.ts/compositions/*.tsx), not a literal depiction of the
 * shot description, so a literal vision-vs-text quality gate can't
 * meaningfully judge it and would fail every Remotion shot by design, not
 * by defect. External-API shots are real photorealistic images generated
 * FROM the description, which a vision critic genuinely can judge.
 *
 * Mutates `shot` in place (critic_passed, critic_reason, retry_count,
 * asset_url); the caller is responsible for persisting it.
 */
async function runCriticLoop(storyboardId, shot, worldState) {
  if (shot.pathway !== 'external_api') return;

  for (;;) {
    const absPath = assetPathFor(storyboardId, shot.asset_url);
    const imageBase64 = await extractFrameBase64(absPath);
    const verdict = await aiServiceClient.criticEvaluate(imageBase64, shot.description);

    shot.critic_passed = verdict.passed;
    shot.critic_reason = verdict.reason;

    if (verdict.passed || shot.retry_count >= CRITIC_MAX_RETRIES) {
      return;
    }

    shot.retry_count += 1;
    shot.asset_url = await generationService.generateShotAsset(storyboardId, shot, worldState);
  }
}

module.exports = { runCriticLoop, CRITIC_MAX_RETRIES };
