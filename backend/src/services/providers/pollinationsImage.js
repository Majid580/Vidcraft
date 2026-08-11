// Tier 1 (free) image provider — Pollinations.ai needs no signup, API key,
// or account at all (PROVIDER-001, ADR-019). A plain GET returns the image
// bytes directly.
const BASE_URL = 'https://image.pollinations.ai/prompt';

async function generateImage(prompt) {
  const url = `${BASE_URL}/${encodeURIComponent(prompt)}?nologo=true`;

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
    model: 'pollinations-default',
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'image/jpeg',
  };
}

module.exports = { generateImage };
