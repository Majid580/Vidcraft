// Deterministic mapping from world_state.style_tokens to a visual theme.
// This is what makes FR-7 (continuity/world-state) visible on screen: the
// same style_tokens always produce the same palette, so every shot in a
// storyboard reuses the same look — no randomness, no LLM call, pure
// function of the input. See PROJECT_ARCHITECTURE.md FR-7.

export type Theme = {
  background: string;
  accent: string;
  text: string;
};

// Small curated set of palettes rather than procedural hue generation —
// keeps every combination visually intentional instead of risking a
// muddy/illegible random color for some hash values.
const PALETTES: Theme[] = [
  { background: '#0b0b12', accent: '#f97316', text: '#ffffff' }, // warm dusk
  { background: '#0a0e1a', accent: '#38bdf8', text: '#ffffff' }, // cool night
  { background: '#120a06', accent: '#f43f5e', text: '#ffffff' }, // sunset red
  { background: '#06120c', accent: '#34d399', text: '#ffffff' }, // overgrown green
  { background: '#0e0a12', accent: '#a78bfa', text: '#ffffff' }, // dream violet
];

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const themeFromStyleTokens = (styleTokens: string[]): Theme => {
  const key = [...styleTokens].sort().join('|');
  const index = hashString(key) % PALETTES.length;
  return PALETTES[index];
};
