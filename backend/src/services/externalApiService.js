// FR-6 / Section 6.6: named, user-selected rendering providers. Per
// ADR-020, pathway/provider is an explicit user choice (made once per
// video, applied to every shot) — not an agent decision (Producer/Router,
// AI-005, is retired) and not an automatic Tier 1/2/3 fallback ladder.
// Provider-specific HTTP logic lives in providers/*.js; this module is
// just the dispatcher everything else should call, so swapping/adding a
// provider never touches route or orchestration code (Risk-table
// mitigation R-8).
//
// No cross-provider fallback: once the user has explicitly picked
// "pollinations" (say) by name, silently substituting "cloudflare" on
// failure would contradict their actual choice — a failure is surfaced as
// an error for that generation instead.
const pollinationsImage = require('./providers/pollinationsImage');
const cloudflareImage = require('./providers/cloudflareImage');
const huggingfaceVideo = require('./providers/huggingfaceVideo');

class ExternalApiError extends Error {
  constructor(message, provider) {
    super(message);
    this.name = 'ExternalApiError';
    this.provider = provider;
  }
}

// 'remotion' is intentionally not a case here — that pathway is handled
// entirely by remotionService.js, never by this dispatcher.
const ADAPTERS = {
  pollinations: (prompt, options) => pollinationsImage.generateImage(prompt, options),
  cloudflare: (prompt, options) => cloudflareImage.generateImage(prompt, options),
  // Video generation takes no continuity options — the pathway is held
  // (see generationService.js's HELD_PROVIDERS) and never reached today.
  huggingface: (prompt) => huggingfaceVideo.generateVideo(prompt),
};

/**
 * @param {string} providerId
 * @param {string} prompt  fully-built prompt (FR-7 world_state already
 *                         injected by services/continuityPrompt.js — adapters
 *                         never see a bare shot.description)
 * @param {object} [options] continuity hints: seed, negativePrompt,
 *                           referenceImageB64, strength. Adapters ignore any
 *                           option their provider doesn't support.
 */
async function generateByProvider(providerId, prompt, options = {}) {
  const adapter = ADAPTERS[providerId];
  if (!adapter) {
    throw new ExternalApiError(`Unknown or unsupported external provider: ${providerId}`, providerId);
  }

  try {
    return await adapter(prompt, options);
  } catch (err) {
    throw new ExternalApiError(`Provider '${providerId}' failed: ${err.message}`, providerId);
  }
}

module.exports = { generateByProvider, ExternalApiError };
