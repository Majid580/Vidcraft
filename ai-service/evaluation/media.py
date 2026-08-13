"""Still-frame generation for the FR-12 evaluation study (EVAL-004).

This is the "Generate output - same backend" step that PROJECT_ARCHITECTURE.md
Section 4.7 draws between each condition and the CLIPScore-style metric, and
that ADR-024/ADR-025 deliberately deferred out of EVAL-002/EVAL-003 rather
than guess at. ADR-030 settles it. Three points matter for reading the
numbers this produces:

**Stills, not video.** The alignment metric is frame-level by construction --
CLIP embeds an image, not a clip -- so a still is what it consumes either
way. The video tier (BACKEND-005) is held on a paid Hugging Face key, and
the Remotion pathway animates *these same stills* with a deterministic
Ken-Burns move rather than synthesising new pixels, so for both available
pathways the still IS the generated content and scoring it is not a
compromise.

**Pollinations, not Cloudflare.** PROVIDER-001 rates Cloudflare FLUX the more
reliable Tier 1 provider (DEMO-001 rehearsal: 4/4 shots vs Pollinations'
2/4), and it would have been the first choice. Its free allocation of 10,000
neurons/day was already exhausted when this ran, so Pollinations is the only
provider available at this scale without payment. It is flakier, which is
why every request here retries with backoff and why a permanently failed
image is recorded as such rather than silently dropped.

**Every image is cached on disk by content hash.** A 50-prompt run over two
conditions is a few hundred requests against a provider that returns real
500s, so a re-run must not re-spend them; the cache also makes the scored
set reproducible after the fact, which a transient provider otherwise makes
impossible.
"""

import hashlib
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/"

DEFAULT_SIZE = 512
DEFAULT_TIMEOUT_SECONDS = 120.0
MAX_ATTEMPTS = 5
BACKOFF_SECONDS = 4.0

# Pollinations' anonymous tier limits by REQUEST RATE, not by image
# complexity, and the interval is the single biggest lever on how long a full
# run takes. Measured live rather than guessed, because the first two guesses
# were both wrong:
#
#   no pacing   -- ~100s/frame, essentially all of it retry backoff
#   5s spacing  -- ~50s/frame, still 429ing on most requests
#   15s spacing -- 0 rate-limits in 6 consecutive requests
#
# The residual cost is the provider's own queue (measured 1.9s-31.8s for the
# same size of prompt, alternating fast/slow, which is what a per-client
# serialising queue looks like), so it is not something more pacing or more
# concurrency can remove. 12s sits just inside the interval that measured
# clean, and the 429 branch below absorbs the occasional miss.
MIN_REQUEST_INTERVAL_SECONDS = 12.0

# A 429 means the pacing was still too aggressive, so it backs off harder
# than a transient network error does.
RATE_LIMIT_BACKOFF_SECONDS = 12.0

_last_request_at = 0.0

# Pollinations serves an HTML error page to some clients that send no
# User-Agent; the DEMO-001 rehearsal saw exactly that failure mode.
USER_AGENT = "VidCraft-Evaluation/1.0 (FR-12 study)"

# A minimum below which a 200 response cannot be a real image. Pollinations
# occasionally returns a short HTML/JSON error body with a 200 status, which
# would otherwise be cached as a valid image and silently corrupt the study.
MIN_IMAGE_BYTES = 1024


class MediaGenerationError(RuntimeError):
    """Raised when a still could not be generated after every retry."""


def compose_render_prompt(description: str, camera: str | None = None) -> str:
    """Compose the text handed to the image model for one frame.

    Deliberately minimal and IDENTICAL in shape for both conditions: the
    framing clause, then the description. See ADR-030 -- this does NOT
    reproduce `backend/src/services/continuityPrompt.js`'s full production
    composition, which additionally prepends Condition B's `world_state` as a
    labelled Subject/Location/Style block. Two reasons. Maintaining a Python
    copy of that JS is exactly the drift ADR-028 refused to allow when it
    exported `assembledShots()` instead of duplicating the shot filter; and
    holding the composition identical across conditions keeps the study's
    independent variable the *text each pipeline produced*, not the
    prompt-assembly code wrapped around it.

    Note the direction of the resulting bias, because it matters when reading
    the comparison table: `world_state` is a genuine product of the
    multi-agent pipeline that Condition A has no equivalent of, so excluding
    it understates Condition B. Any Condition B win measured here is
    therefore a floor, not a ceiling.
    """
    parts = []
    if camera and camera.strip():
        parts.append(camera.strip().rstrip(".;, "))
    if description and description.strip():
        parts.append(description.strip().rstrip(".;, "))
    if not parts:
        raise ValueError("cannot compose a render prompt from empty description and camera")
    return ". ".join(parts) + "."


def cache_key(prompt: str, *, seed: int, size: int) -> str:
    """Stable content hash for one (prompt, seed, size) triple."""
    payload = f"{size}x{size}|{seed}|{prompt}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:32]


def _throttle(min_interval: float = MIN_REQUEST_INTERVAL_SECONDS) -> None:
    """Sleep just long enough that requests stay ``min_interval`` apart.

    Module-level rather than per-call state, because the limit is per client
    against a shared provider — every caller in the process draws on the same
    budget. Cache hits never reach here, so a re-run over already-generated
    frames costs nothing.
    """
    global _last_request_at
    wait = min_interval - (time.monotonic() - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.monotonic()


def _fetch_pollinations(prompt: str, *, seed: int, size: int, timeout: float) -> bytes:
    """One real HTTP request to Pollinations. Raises on any failure."""
    _throttle()
    encoded = urllib.parse.quote(prompt, safe="")
    query = urllib.parse.urlencode(
        {"width": size, "height": size, "seed": seed, "nologo": "true"}
    )
    url = f"{POLLINATIONS_BASE}{encoded}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        body = response.read()
    # Pollinations answers some failures with a 200 and an HTML or JSON error
    # page. Without this the body would sail through as a "successful" frame.
    if not content_type.startswith("image/"):
        raise MediaGenerationError(
            f"provider returned content-type {content_type!r}, not an image: "
            f"{body[:160].decode('utf-8', errors='replace')}"
        )
    return body


def generate_still(
    prompt: str,
    *,
    seed: int,
    size: int = DEFAULT_SIZE,
    cache_dir: Path | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_attempts: int = MAX_ATTEMPTS,
    fetch=None,
) -> bytes:
    """Return image bytes for ``prompt``, from cache when already generated.

    ``fetch`` is the injection point used by the offline checks (same pattern
    as ``rag/index.py``'s ``embed_fn`` and ``AI-007``'s
    ``_load_production_index``) so nothing in a test run touches the network.

    Raises :class:`MediaGenerationError` when every attempt fails, so the
    caller can record the frame as failed instead of scoring a placeholder.
    """
    fetch = fetch or _fetch_pollinations

    path = None
    if cache_dir is not None:
        cache_dir = Path(cache_dir)
        cache_dir.mkdir(parents=True, exist_ok=True)
        path = cache_dir / f"{cache_key(prompt, seed=seed, size=size)}.jpg"
        if path.exists() and path.stat().st_size >= MIN_IMAGE_BYTES:
            return path.read_bytes()

    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            body = fetch(prompt, seed=seed, size=size, timeout=timeout)
            # Validated HERE rather than inside the fetch so the invariant
            # "nothing that isn't an image reaches the cache" holds for every
            # fetch implementation, not just the Pollinations one. A cached
            # error page would be indistinguishable from a real frame on the
            # next run and would quietly corrupt the scored set.
            if len(body) < MIN_IMAGE_BYTES:
                raise MediaGenerationError(
                    f"provider returned {len(body)} bytes — too small to be an image"
                )
        except (urllib.error.URLError, MediaGenerationError, OSError) as exc:
            last_error = exc
            if attempt < max_attempts:
                rate_limited = getattr(exc, "code", None) == 429
                delay = (RATE_LIMIT_BACKOFF_SECONDS if rate_limited else BACKOFF_SECONDS) * attempt
                logger.warning(
                    "still generation attempt %d/%d failed (%s%s); retrying in %.0fs",
                    attempt,
                    max_attempts,
                    "rate-limited: " if rate_limited else "",
                    exc,
                    delay,
                )
                time.sleep(delay)
            continue

        if path is not None:
            path.write_bytes(body)
        return body

    raise MediaGenerationError(
        f"could not generate a still after {max_attempts} attempts: {last_error}"
    )
