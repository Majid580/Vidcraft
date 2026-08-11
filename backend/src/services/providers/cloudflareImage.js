// Tier 1 (free, alternate) image provider — Cloudflare Workers AI. Real
// account + API token live-validated in PROVIDER-001/ADR-019; text-to-image
// catalog confirmed to include FLUX.1/FLUX.2, SDXL, Leonardo Phoenix.
// flux-1-schnell is the fast, free-tier-friendly default.
const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';

async function generateImage(prompt, { model = DEFAULT_MODEL } = {}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN)');
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
      body: JSON.stringify({ prompt }),
    });
  } catch (cause) {
    throw new Error(`Cloudflare Workers AI unreachable: ${cause.message}`);
  }

  // FLUX models on Workers AI always respond with JSON — base64 image on
  // success (`result.image`), structured error list on failure — never raw
  // image bytes, regardless of HTTP status (live-verified 2026-08-11).
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const message = data.errors?.[0]?.message || `Cloudflare Workers AI returned ${res.status}`;
    throw new Error(message);
  }

  return {
    provider: 'cloudflare',
    tier: 1,
    model,
    buffer: Buffer.from(data.result.image, 'base64'),
    contentType: 'image/jpeg',
  };
}

module.exports = { generateImage, DEFAULT_MODEL };
