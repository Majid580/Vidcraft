// FR-6 / ADR-020: the user picks exactly one of these, by name, before
// generation — no agent decides this (Producer/Router, AI-005, is retired).
// Single source of truth so the model, the route, and externalApiService
// can't drift out of sync on what a valid provider is.
const RENDER_PROVIDERS = ['remotion', 'pollinations', 'cloudflare', 'huggingface'];

// The subset of RENDER_PROVIDERS that can produce a single still image on
// demand (used by the single-image mode, POST /api/images — no storyboard,
// no shot decomposition). Remotion needs a shot/composition to render and
// huggingface is video-only, so neither applies here.
const IMAGE_PROVIDERS = ['pollinations', 'cloudflare'];

// Every non-Remotion provider is still an "external_api" pathway shot for
// anything (Remotion compositions, generation-status UI) that only cares
// about the free/guaranteed vs paid/best-effort distinction, not which
// specific paid provider was used.
function pathwayForProvider(provider) {
  return provider === 'remotion' ? 'remotion' : 'external_api';
}

module.exports = { RENDER_PROVIDERS, IMAGE_PROVIDERS, pathwayForProvider };
