// Shot -> composition taxonomy (REMOTION-003, resolves open question R-11).
//
// Lives in src/ as plain .mjs because it now has two consumers that cannot
// share a TypeScript module: the Node-side render entry points
// (render-shot.mjs / render-storyboard.mjs, which pick a composition id
// before bundling) and the browser-side StoryboardVideo composition (which
// picks a component per shot inside a <Series>). One copy, imported by both
// — the alternative was duplicating the mapping and letting it drift.
//
// Keyed on the leading word of shot.camera, matching the composition library
// built in REMOTION-002 (WideShot / MediumShot / CloseUpShot). Any
// shot.camera that doesn't match a recognized shot-type word falls back to
// MediumShot — a documented default, never a thrown error, per REMOTION-003's
// acceptance criteria ("arbitrary shot JSON maps to a valid composition or
// documented default").

/**
 * @param {{camera?: string}} shot
 * @returns {'WideShot' | 'MediumShot' | 'CloseUpShot'}
 */
export function selectCompositionId(shot) {
  const camera = (shot.camera ?? '').trim().toLowerCase();
  if (camera.startsWith('wide')) return 'WideShot';
  if (camera.startsWith('medium')) return 'MediumShot';
  if (
    camera.startsWith('close-up') ||
    camera.startsWith('close up') ||
    camera.startsWith('closeup')
  ) {
    return 'CloseUpShot';
  }
  return 'MediumShot'; // documented fallback default: the most visually
  // neutral of the three (frames a subject without committing to an
  // establishing wide or an intimate close-up), and reuses an existing
  // composition rather than a purpose-built "unknown shot" template.
}
