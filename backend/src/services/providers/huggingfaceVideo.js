// Tier 1 (free) video provider — Hugging Face Inference Providers. Per
// PROVIDER-001/ADR-019 this is the actual video provider, not a fallback:
// Cloudflare Workers AI has no video-generation model in its real catalog.
// Uses the official @huggingface/inference client rather than hand-rolled
// HTTP, since it owns provider routing/polling for the underlying
// third-party model host (fal-ai here) — reverse-engineering that
// queue/poll protocol ourselves would duplicate what the client already
// does correctly.
const { InferenceClient } = require('@huggingface/inference');

// Wan2.1 1.3B is the smallest/cheapest model on the HF text-to-video
// catalog (fal-ai-hosted) — picked to go easy on the free monthly router
// credits (PROVIDER-001 found these deplete fast; see PROJECT_PROGRESS.md).
const DEFAULT_MODEL = 'Wan-AI/Wan2.1-T2V-1.3B';
const DEFAULT_PROVIDER = 'fal-ai';

async function generateVideo(prompt, { model = DEFAULT_MODEL, provider = DEFAULT_PROVIDER } = {}) {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    throw new Error('Hugging Face credentials not configured (HUGGINGFACE_API_TOKEN)');
  }

  const client = new InferenceClient(token);

  let blob;
  try {
    blob = await client.textToVideo({ model, provider, inputs: prompt });
  } catch (cause) {
    throw new Error(`Hugging Face text-to-video failed: ${cause.message}`);
  }

  return {
    provider: 'huggingface',
    tier: 1,
    model,
    buffer: Buffer.from(await blob.arrayBuffer()),
    contentType: blob.type || 'video/mp4',
  };
}

module.exports = { generateVideo, DEFAULT_MODEL, DEFAULT_PROVIDER };
