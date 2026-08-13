"""CLIPScore-style image-text alignment metric (EVAL-004, FR-12).

The metric arm of PROJECT_ARCHITECTURE.md Section 4.7: given a generated
frame and a reference text, how well does the picture match the words?

Implements CLIPScore in the standard form (Hessel et al., 2021):

    CLIP-S(image, text) = w * max(cosine(E_image, E_text), 0),  w = 2.5

The raw cosine is reported alongside it, because the 2.5 factor is a
readability convention rather than information -- it exists to spread CLIP's
typically narrow 0.2-0.4 cosine band across a friendlier range, and every
comparison in this study is a *difference between conditions*, which the
scaling leaves untouched.

**What text the score is taken against is the load-bearing decision, not the
model choice.** Every frame here is scored against the ORIGINAL evaluation
prompt -- never against the text the condition itself produced. Scoring a
frame against its own generating text would measure how faithfully the image
model followed whatever it was handed, which is a property of Pollinations,
not of the pipeline under test, and it would reward verbosity in the
enhancement step. Holding the reference fixed at the user's original prompt
is what makes this a controlled comparison: the reference is identical for
both conditions, so the only thing that varies is the pipeline that produced
the frame. See ADR-030.

Model choice: `clip-ViT-B-32` through `sentence-transformers`, which is
already this project's embedding library (RAG-001/FR-4 uses the same package
for `all-MiniLM-L6-v2`) and can encode images and text into one shared
space. Running it locally is the narrow exception ADR-015 already granted to
`sentence-transformers` + `torch`, not a new departure from the
hosted-inference rule -- and unlike an LLM, this is a one-off scoring pass
over a few hundred images that never runs in the request path.
"""

import functools
import io

import numpy as np

CLIP_MODEL_NAME = "clip-ViT-B-32"

# Hessel et al. (2021)'s scaling constant. See the module docstring: it
# rescales for readability and cancels out of any between-condition delta.
CLIPSCORE_SCALE = 2.5


class AlignmentError(RuntimeError):
    """Raised when an image cannot be decoded for scoring."""


@functools.lru_cache(maxsize=1)
def get_model():
    """Load the CLIP encoder once per process and cache it.

    Imported lazily inside the function, mirroring ``rag/embedder.py``, so
    that importing this module stays cheap and the offline checks can inject
    their own scorer without pulling in torch.
    """
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(CLIP_MODEL_NAME)


def _decode(image_bytes: bytes):
    from PIL import Image, UnidentifiedImageError

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise AlignmentError(f"could not decode image ({len(image_bytes)} bytes): {exc}") from exc
    return image.convert("RGB")


def _unit(vectors: np.ndarray) -> np.ndarray:
    vectors = np.asarray(vectors, dtype="float32")
    if vectors.ndim == 1:
        vectors = vectors[None, :]
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    # A zero vector cannot be normalized; leave it alone rather than emit NaN,
    # which would silently poison every mean computed downstream.
    norms[norms == 0] = 1.0
    return vectors / norms


def cosine_scores(images: list[bytes], text: str, *, model=None) -> list[float]:
    """Cosine similarity between each image and ``text`` in CLIP space.

    Images are encoded in one batch -- a few hundred frames on CPU is the
    difference between one pass and one pass per frame.
    """
    if not images:
        return []
    if not isinstance(text, str) or not text.strip():
        raise ValueError("reference text must be a non-empty string")

    model = model or get_model()
    decoded = [_decode(b) for b in images]

    image_vectors = _unit(model.encode(decoded, convert_to_numpy=True))
    text_vector = _unit(model.encode([text], convert_to_numpy=True))

    return [float(v) for v in (image_vectors @ text_vector.T).ravel()]


def clipscore(cosine: float) -> float:
    """CLIPScore from a raw cosine: ``2.5 * max(cosine, 0)``."""
    return CLIPSCORE_SCALE * max(float(cosine), 0.0)


def score_frames(images: list[bytes], reference_text: str, *, model=None) -> list[dict]:
    """Score ``images`` against ``reference_text``.

    Returns one ``{"cosine", "clipscore"}`` per image, in input order.
    """
    return [
        {"cosine": c, "clipscore": clipscore(c)}
        for c in cosine_scores(images, reference_text, model=model)
    ]
