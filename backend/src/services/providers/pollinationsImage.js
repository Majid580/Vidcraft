// Tier 1 (free) image provider — Pollinations.ai needs no signup, API key,
// or account at all (PROVIDER-001, ADR-019). A plain GET returns the image
// bytes directly.
//
// FR-7 continuity: this adapter accepts (and forwards) the shared seed and
// negative prompt built by services/continuityPrompt.js. Two parameters
// matter beyond the obvious `seed`:
//   - `enhance=false` is set explicitly. Pollinations' enhancer rewrites the
//     incoming prompt with an LLM before generating, which would rewrite the
//     invariant world_state block differently for every shot and destroy the
//     exact thing continuity depends on.
//   - `nofeed=true` keeps storyboard frames off the public feed.
// Image-to-image is deliberately not wired here: Pollinations' `image[]`
// parameter takes a publicly-fetchable URL, and generated assets live on the
// backend's local /media mount, which Pollinations cannot reach. Reference
// anchoring is therefore a Cloudflare-only tier (see cloudflareImage.js).
const BASE_URL = 'https://image.pollinations.ai/prompt';

// 16:9 at 1080p so stills drop straight into the 1920x1080 Remotion
// storyboard composition without letterboxing, and with enough resolution
// left over for the Ken Burns push to crop into without visible softening.
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

async function generateImage(prompt, options = {}) {
  const {
    seed,
    negativePrompt,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
  } = options;

  const params = new URLSearchParams({
    nologo: 'true',
    nofeed: 'true',
    enhance: 'false',
    width: String(width),
    height: String(height),
  });

  // Model is opt-in: leaving it unset keeps Pollinations' own default, which
  // is what PROVIDER-001 live-validated. Pinning it is available via env for
  // anyone who wants full run-to-run reproducibility for the FR-12 study.
  if (process.env.POLLINATIONS_MODEL) {
    params.set('model', process.env.POLLINATIONS_MODEL);
  }
  if (Number.isInteger(seed)) params.set('seed', String(seed));
  if (negativePrompt) params.set('negative_prompt', negativePrompt);

  const url = `${BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (cause) {
    throw new Error(`Pollinations unreachable: ${cause.message}`);
  }

  if (!res.ok) {
    throw new Error(`Pollinations returned ${res.status}`);
  }

  return {
    provider: 'pollinations',
    tier: 1,
    model: process.env.POLLINATIONS_MODEL || 'pollinations-default',
    seed: Number.isInteger(seed) ? seed : undefined,
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'image/jpeg',
  };
}

module.exports = { generateImage };
