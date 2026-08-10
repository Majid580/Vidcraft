// Mirrors the storyboard/shot JSON shape from VidCraft_Proposal.tex Section 6.3
// and PROJECT_ARCHITECTURE.md FR-3/FR-7. This is PROPOSED, not a ratified
// schema (see PROJECT_ARCHITECTURE.md Section 20 note on ER diagrams) — kept
// in sync manually with the backend's eventual Mongoose schema (BACKEND-002).

export type WorldState = {
  characters: string[];
  setting: string;
  style_tokens: string[];
  reference_image_url?: string;
};

export type Shot = {
  shot_id: number;
  description: string;
  camera: string;
  duration_s: number;
  pathway: 'remotion' | 'external_api';
};

export type ShotCompositionProps = {
  shot: Shot;
  worldState: WorldState;
};
