// Tier 1 (free, alternate) image provider — Cloudflare Workers AI. Real
// account + API token live-validated in PROVIDER-001/ADR-019; text-to-image
// catalog confirmed to include FLUX.1/FLUX.2, SDXL, Leonardo Phoenix.
// flux-1-schnell is the fast, free-tier-friendly default.
//
// FR-7 continuity — this adapter carries the top tier of the ladder built in
// services/continuityPrompt.js. Beyond the shared prompt + shared seed, it
// can condition a shot on a *reference image* (the storyboard's first
// generated frame, held in world_state.reference_image_url): img2img keeps
// the subject, palette and lighting of the reference while the new prompt
// re-poses the scene. That is the closest this provider set gets to "same
// subject doing different things".
//
// flux-1-schnell has no img2img endpoint, so reference-conditioned shots run
// on Stable Diffusion v1.5 img2img instead. `strength` is the trade-off dial
// (Cloudflare's semantics: lower keeps the output closer to the input) —
// too low and every shot is a near-copy of the reference with no new action,
// too high and the anchoring washes out. See CONTINUITY_STRENGTH below.
const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

// Live sweep against real credentials (2026-08-12), three-shot storyboard:
// 0.65 and 0.75 both keep the reference's composition wholesale (a wide, a
// medium and a close-up all rendered as the same standing pose); 0.95 buys
// compositional freedom but destroys the anchoring (wardrobe colour changed,
// setting lost, a second person appeared in frame). There is no value that
// gives both — which is why reference anchoring is off by default (see
// generationService.js). 0.75 is kept as the least-bad setting for anyone
// enabling it deliberately as an FR-12 evaluation condition.
const CONTINUITY_STRENGTH = Number(process.env.CONTINUITY_STRENGTH || 0.75);

// flux-1-schnell (the unanchored default) returns 1024x1024, but the SD v1.5
// img2img model defaults to 512x512 — so anchored shots silently came back at
// a quarter of the reference's resolution, which then had to be upscaled into
// a 1920x1080 video. Pin img2img to match the reference so a storyboard never
// mixes resolutions mid-sequence.
const IMG2IMG_SIZE = 1024;

function credentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN)');
  }
  return { accountId, apiToken };
}

/**
 * Workers AI is not uniform about its image response encoding: FLUX replies
 * with JSON (`result.image`, base64), while the SD img2img model streams raw
 * image bytes back. Branch on what actually arrived rather than on which
 * model we asked for, so neither path breaks if Cloudflare changes it.
 */
async function decodeImageResponse(res, model) {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const message = data.errors?.[0]?.message || `Cloudflare Workers AI returned ${res.status}`;
      throw new Error(message);
    }
    return { buffer: Buffer.from(data.result.image, 'base64'), contentType: 'image/jpeg' };
  }

  const raw = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    // A non-JSON error body is still worth surfacing verbatim (truncated) —
    // an opaque status code alone makes provider failures undiagnosable.
    throw new Error(
      `Cloudflare Workers AI (${model}) returned ${res.status}: ${raw.toString('utf8').slice(0, 200)}`,
    );
  }
  return { buffer: raw, contentType: contentType || 'image/png' };
}

/**
 * @param {string} prompt
 * @param {object} [options]
 * @param {number}  [options.seed]              shared storyboard seed (FR-7)
 * @param {string}  [options.negativePrompt]
 * @param {string}  [options.referenceImageB64] base64 reference; switches this
 *                                              call to the img2img model
 * @param {number}  [options.strength]          img2img anchoring dial (0-1)
 */
async function generateImage(prompt, options = {}) {
  const { accountId, apiToken } = credentials();
  const {
    seed,
    negativePrompt,
    referenceImageB64,
    strength = CONTINUITY_STRENGTH,
  } = options;

  const useImg2Img = Boolean(referenceImageB64);
  const model = options.model || (useImg2Img ? IMG2IMG_MODEL : DEFAULT_MODEL);

  const body = { prompt };
  if (Number.isInteger(seed)) body.seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (useImg2Img) {
    body.image_b64 = referenceImageB64;
    body.strength = strength;
    body.width = IMG2IMG_SIZE;
    body.height = IMG2IMG_SIZE;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new Error(`Cloudflare Workers AI unreachable: ${cause.message}`);
  }

  const { buffer, contentType } = await decodeImageResponse(res, model);

  return {
    provider: 'cloudflare',
    tier: 1,
    model,
    seed: Number.isInteger(seed) ? seed : undefined,
    conditionedOnReference: useImg2Img,
    buffer,
    contentType,
  };
}

module.exports = {
  generateImage,
  DEFAULT_MODEL,
  IMG2IMG_MODEL,
  CONTINUITY_STRENGTH,
  IMG2IMG_SIZE,
};
