// FR-7 (continuity / world-state management) for the external-API pathway.
//
// The storyboard's world_state is built once by the Screenwriter
// (characters/setting, AI-004) and enriched by the Cinematographer
// (style_tokens, RAG-grounded, AI-007) — but none of it used to reach the
// image providers: generationService sent only `shot.description`, so every
// shot was an independent draw from a different short sentence and the
// results shared no subject, no environment and no palette.
//
// This module is the injection point FR-7 already specifies ("constructed
// once per storyboard, injected into every shot's generation call"). Two
// deterministic mechanisms:
//
//   1. A canonical prompt (`buildShotPrompt`). The invariant world
//      description leads and the per-shot action trails, because diffusion
//      text encoders weight earlier tokens more heavily — so the subject and
//      location stay fixed while only the action varies, which is exactly
//      the "same subject doing different things" property a storyboard needs.
//   2. A storyboard-derived seed (`seedForStoryboard`), identical for every
//      shot, so all shots start from the same latent noise and land in the
//      same visual neighbourhood (palette, lighting, rendering style).
//
// Neither gives pixel-level identity lock — that needs reference-image
// conditioning (providers/cloudflareImage.js's img2img path, layered on top
// of these two) or IP-Adapter/InstantID-class tooling that no provider used
// here exposes. Per the proposal's risk table ("Character consistency on API
// pathway is visibly weak" — Likelihood High, Impact Low), this tier is
// explicitly best-effort, not a guarantee.

// Appended to every shot prompt. Phrased as properties of the image rather
// than instructions, since diffusion models condition on description, not
// on imperatives.
const CONSISTENCY_SUFFIX = [
  'consistent character design',
  'consistent colour palette and lighting',
  'single cinematic still frame',
].join(', ');

// Framing vocabulary, keyed by the same leading word as the Remotion shot
// taxonomy (remotion/src/shotTaxonomy.mjs).
//
// The Screenwriter's raw camera strings ("close-up, static") are too terse to
// move a diffusion model off its default framing — a first live run with the
// raw string produced three identically-framed portraits for a wide, a
// medium and a close-up. These expansions describe what should be *in frame*,
// which is what actually changes the composition.
//
// Motion words in the camera string ("slow dolly-in", "handheld") are
// deliberately dropped here: a still cannot express movement, and that half
// of the direction is not lost — it is what drives the per-shot camera move
// in the Remotion compositions. Framing goes to the image model, motion goes
// to the compositor.
const FRAMING_PHRASES = {
  WideShot:
    'wide establishing shot, full body visible, subject small within a large environment, expansive background',
  MediumShot: 'medium shot, subject framed from the waist up, background softly visible',
  CloseUpShot:
    'extreme close-up, tightly cropped on the described detail, background thrown far out of focus',
};

/**
 * Maps a shot's camera direction to an image-generation framing phrase.
 * Mirrors remotion/src/shotTaxonomy.mjs's mapping (same leading-word keys,
 * same MediumShot fallback) so a shot is framed the same way by the image
 * provider and by the composition that later animates it.
 */
function framingPhrase(camera) {
  const value = (camera ?? '').trim().toLowerCase();
  if (value.startsWith('wide')) return FRAMING_PHRASES.WideShot;
  if (value.startsWith('medium')) return FRAMING_PHRASES.MediumShot;
  if (
    value.startsWith('close-up') ||
    value.startsWith('close up') ||
    value.startsWith('closeup')
  ) {
    return FRAMING_PHRASES.CloseUpShot;
  }
  return FRAMING_PHRASES.MediumShot;
}

// Sent as a negative prompt where the provider supports one. Targets the
// specific failure modes that break a storyboard: the subject silently
// becoming a different person between shots, the render style drifting, and
// multi-panel/contact-sheet outputs that can't be used as a single shot.
const DEFAULT_NEGATIVE_PROMPT = [
  'different person',
  'inconsistent character',
  'changing art style',
  'collage',
  'split screen',
  'multiple panels',
  'contact sheet',
  'text',
  'caption',
  'watermark',
  'signature',
  'border',
].join(', ');

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

// Segments are joined into one sentence-per-clause prompt; strip any
// trailing punctuation first so the join doesn't produce ".." runs.
const clean = (value) => value.trim().replace(/[.;,\s]+$/, '');

/**
 * Builds the full generation prompt for one shot: the storyboard's
 * invariant world_state first, this shot's action and framing last.
 *
 * Labelled clauses ("Subject:", "Location:") rather than free prose —
 * repeating the *identical* token sequence across every shot in a storyboard
 * is what actually holds the subject and environment steady, and labels keep
 * that block byte-identical no matter what the per-shot description says.
 *
 * @param {{description: string, camera?: string}} shot
 * @param {{characters?: string[], setting?: string, style_tokens?: string[]}} worldState
 * @returns {string}
 */
function buildShotPrompt(shot, worldState = {}) {
  const characters = (worldState.characters || []).filter(nonEmpty).map(clean);
  const setting = nonEmpty(worldState.setting) ? clean(worldState.setting) : '';
  const styleTokens = (worldState.style_tokens || []).filter(nonEmpty).map(clean);

  const segments = [];

  // --- Variable block first ---
  // Diffusion text encoders weight earlier tokens most heavily, and framing
  // plus action are the two properties that MUST differ between shots — a
  // storyboard whose every shot is composed identically is not a storyboard.
  // Both were originally at the tail, where they lost to the invariant block
  // and every shot came back as the same portrait. The action rides directly
  // behind the framing so that, on a close-up, the detail being described is
  // what gets cropped to rather than the head-to-toe Subject description.
  segments.push(framingPhrase(shot.camera));
  if (nonEmpty(shot.description)) segments.push(clean(shot.description));

  // --- Invariant block: byte-identical for every shot in the storyboard ---
  // Repeating the exact same token sequence is what holds the subject,
  // location and palette steady across shots. It trails the variable block
  // but still sits well inside the encoder's attention window.
  if (characters.length) segments.push(`Subject: ${characters.join('; ')}`);
  if (setting) segments.push(`Location: ${setting}`);
  if (styleTokens.length) segments.push(`Style: ${styleTokens.join(', ')}`);

  segments.push(CONSISTENCY_SUFFIX);

  return `${segments.join('. ')}.`;
}

/**
 * Deterministic 31-bit seed from a storyboard id.
 *
 * FNV-1a, in the same spirit as remotion/src/theme.ts's `hashString`: no
 * dependency, stable across processes and restarts (unlike `Math.random`,
 * which would re-randomise the whole look on every regeneration and make
 * the FR-12 evaluation unreproducible). Clamped below 2^31 because several
 * providers reject seeds outside signed-32-bit range.
 *
 * @param {string} storyboardId
 * @returns {number}
 */
function seedForStoryboard(storyboardId) {
  let hash = 2166136261;
  const input = String(storyboardId);
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483647;
}

/**
 * Per-shot seed: deterministic, derived from the storyboard's seed, but
 * distinct for each shot.
 *
 * An identical seed across shots was the obvious first choice for continuity
 * and it is the wrong one — live testing showed it pins the *composition*,
 * not just the palette, so a wide, a medium and a close-up all came back as
 * the same framing. Continuity has to come from the repeated prompt block;
 * the seed's job is only to keep a given shot reproducible between runs.
 *
 * Still fully deterministic: the same (storyboard, shot) always regenerates
 * the same image, which the FR-12 evaluation depends on.
 *
 * @param {string} storyboardId
 * @param {number} shotId
 * @returns {number}
 */
function seedForShot(storyboardId, shotId) {
  const base = seedForStoryboard(storyboardId);
  return (base + Math.imul(Number(shotId) || 0, 2654435761)) % 2147483647;
}

module.exports = {
  buildShotPrompt,
  seedForStoryboard,
  seedForShot,
  framingPhrase,
  DEFAULT_NEGATIVE_PROMPT,
  CONSISTENCY_SUFFIX,
};
