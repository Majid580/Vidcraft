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
  // Absolute http URL of this shot's generated still (the backend's /media
  // mount). Present once an image provider has generated the shot; absent
  // for a pure-Remotion storyboard, in which case the compositions fall back
  // to their motion-graphics card. This is the field that turns Remotion
  // from a text-card renderer into the compositor for FR-9.
  imageSrc?: string;
};

export type ShotCompositionProps = {
  shot: Shot;
  worldState: WorldState;
};

// FR-9: the whole storyboard as one continuous video — every shot's still,
// in order, each held for its own duration_s. This is the composition the
// backend renders to produce the final deliverable.
export type StoryboardCompositionProps = {
  shots: Shot[];
  worldState: WorldState;
};
