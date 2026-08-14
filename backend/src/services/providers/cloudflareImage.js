// Tier 1 (free, alternate) image provider — Cloudflare Workers AI. Real
// account + API token live-validated in PROVIDER-001/ADR-019; text-to-image
// catalog confirmed to include FLUX.1/FLUX.2, SDXL, Leonardo Phoenix.
// Leonardo Phoenix is the default: fast, free-tier-friendly, and the only
// candidate whose schema honours this project's seed + negative prompt.
//
// FR-7 continuity — this adapter carries the top tier of the ladder built in
// services/continuityPrompt.js. Beyond the shared prompt + shared seed, it
// can condition a shot on a *reference image* (the storyboard's first
// generated frame, held in world_state.reference_image_url): img2img keeps
// the subject, palette and lighting of the reference while the new prompt
// re-poses the scene. That is the closest this provider set gets to "same
// subject doing different things".
//
// The text-to-image model has no img2img endpoint, so reference-conditioned
// shots run on Stable Diffusion v1.5 img2img instead. `strength` is the
// trade-off dial (Cloudflare's semantics: lower keeps the output closer to
// the input) — too low and every shot is a near-copy of the reference with no
// new action, too high and the anchoring washes out. See CONTINUITY_STRENGTH.
//
// DEFAULT_MODEL was flux-1-schnell until 2026-08-14, when it turned out to be
// the wrong model for this pipeline — see MODEL_INPUTS below for the failure
// and the live comparison that picked Leonardo Phoenix instead.
const DEFAULT_MODEL = '@cf/leonardo/phoenix-1.0';
const IMG2IMG_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

// Workers AI validates every request body against the target model's own
// published input schema (`GET /accounts/{id}/ai/models/schema?model=…`) and
// rejects anything that schema does not declare:
//
//   AiError: Bad input: Error: Additional or unevaluated properties
//   '/seed, /negative_prompt' at '/' not allowed          (code 5006)
//
// Those schemas are NOT uniform across the catalog, so the body has to be
// built per *model*, not per provider. flux-1-schnell — the previous default
// — declares only {prompt, steps}: it never accepted this project's FR-7
// continuity parameters at all, and the adapter sent them on every call.
//
// Two things made that hard to see. Enforcement is inconsistent across
// Cloudflare's fleet (live probe, 2026-08-14: the *same* illegal body
// returned 200 once and 400 twice in three consecutive calls), so a
// storyboard failed on some shots and rendered on others within a single run
// — and the shots that did render had silently dropped the seed and the
// negative prompt, so the continuity guarantees in continuityPrompt.js were
// never actually in force on this provider.
//
// Adding a model here is therefore mandatory, not optional: an unlisted model
// is sent `prompt` alone (see buildBody), which is the only property every
// text-to-image schema in the catalog declares.
const MODEL_INPUTS = {
  '@cf/leonardo/phoenix-1.0': new Set([
    'prompt', 'negative_prompt', 'seed', 'width', 'height', 'num_steps', 'guidance',
  ]),
  '@cf/runwayml/stable-diffusion-v1-5-img2img': new Set([
    'prompt', 'negative_prompt', 'seed', 'width', 'height', 'num_steps', 'guidance',
    'strength', 'image_b64', 'image', 'mask',
  ]),
  // Kept so an explicit options.model still works, not because they are used:
  '@cf/black-forest-labs/flux-1-schnell': new Set(['prompt', 'steps']),
  '@cf/bytedance/stable-diffusion-xl-lightning': new Set([
    'prompt', 'negative_prompt', 'seed', 'width', 'height', 'num_steps', 'guidance',
    'strength', 'image_b64', 'image', 'mask',
  ]),
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': new Set([
    'prompt', 'negative_prompt', 'seed', 'width', 'height', 'num_steps', 'guidance',
    'strength', 'image_b64', 'image', 'mask',
  ]),
};

// Why Phoenix and not the other two schema-compatible candidates. Measured
// live on the same prompt, 1024x1024, seed + full negative prompt, 2026-08-14:
//
//   model                        latency   same seed twice   output
//   leonardo/phoenix-1.0         ~3.1s     IDENTICAL bytes   photoreal, image/jpeg
//   bytedance/sdxl-lightning     ~4.0s     differs           plastic-looking, image/png
//                                                            header on JPEG bytes
//   stabilityai/sdxl-base-1.0    ~10.8s    differs           slowest, 1.2MB PNG
//
// The determinism column is the deciding one. FR-12's evaluation and
// continuityPrompt.js's seedForShot both rest on "the same (storyboard, shot)
// regenerates the same image"; Phoenix is the only one of the three where
// that is true, and it is also the fastest. Its content-type header matches
// its actual bytes, which the SDXL models get wrong (they label JPEG output
// as image/png) — that header is what names the file on disk.
//
// Size is pinned explicitly on every model that accepts width/height rather
// than left to per-model defaults: SD v1.5 img2img defaults to 512x512, so
// anchored shots used to come back at a quarter of the unanchored ones'
// resolution and were then upscaled into a 1920x1080 video. A storyboard must
// never mix resolutions mid-sequence.
const RENDER_SIZE = 1024;

// Live sweep against real credentials (2026-08-12), three-shot storyboard:
// 0.65 and 0.75 both keep the reference's composition wholesale (a wide, a
// medium and a close-up all rendered as the same standing pose); 0.95 buys
// compositional freedom but destroys the anchoring (wardrobe colour changed,
// setting lost, a second person appeared in frame). There is no value that
// gives both — which is why reference anchoring is off by default (see
// generationService.js). 0.75 is kept as the least-bad setting for anyone
// enabling it deliberately as an FR-12 evaluation condition.
const CONTINUITY_STRENGTH = Number(process.env.CONTINUITY_STRENGTH || 0.75);

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
 * with JSON (`result.image`, base64), while Phoenix and the SD models stream
 * raw image bytes back. Branch on what actually arrived rather than on which
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
 * Keep only the properties the target model's schema declares. Anything else
 * is not merely ignored by Workers AI — it fails the whole request (code
 * 5006), sometimes. `prompt` is the floor for an unlisted model: it is the
 * one property every text-to-image schema in the catalog declares, so an
 * unrecognised model degrades to a plain render instead of a 400.
 */
function buildBody(model, candidate) {
  const allowed = MODEL_INPUTS[model];
  const body = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined) continue;
    if (allowed ? allowed.has(key) : key === 'prompt') body[key] = value;
  }
  return body;
}

/**
 * @param {string} prompt
 * @param {object} [options]
 * @param {number}  [options.seed]              per-shot seed (FR-7)
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

  const body = buildBody(model, {
    prompt,
    seed: Number.isInteger(seed) ? seed : undefined,
    negative_prompt: negativePrompt || undefined,
    width: RENDER_SIZE,
    height: RENDER_SIZE,
    image_b64: useImg2Img ? referenceImageB64 : undefined,
    strength: useImg2Img ? strength : undefined,
  });

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
    // Report what was actually *sent*, not what was asked for. A model whose
    // schema has no `seed` silently renders something unreproducible, and
    // claiming a seed we dropped is what let the flux-1-schnell mismatch go
    // unnoticed — FR-12 reads this field as evidence of determinism.
    seed: body.seed,
    negativePromptApplied: Boolean(body.negative_prompt),
    conditionedOnReference: useImg2Img,
    buffer,
    contentType,
  };
}

module.exports = {
  generateImage,
  buildBody,
  MODEL_INPUTS,
  DEFAULT_MODEL,
  IMG2IMG_MODEL,
  CONTINUITY_STRENGTH,
  RENDER_SIZE,
};
