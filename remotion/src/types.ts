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

// FR-10 (NARR-001, ADR-032): one continuous thing happening on screen, with
// one line of voiceover over it. `duration_s` here is MEASURED from the
// synthesised speech, never authored — which is what makes the voice and the
// picture impossible to desynchronise: the shot is held for exactly as long
// as the lines it carries. A beat with empty narration is deliberately
// silent and still occupies time.
export type Beat = {
  beat_id: number;
  action: string;
  narration: string;
  duration_s: number;
  // Absolute http URL of this beat's synthesised audio (the backend's /media
  // mount). Absent when the beat is silent, or when narration was never
  // generated for this storyboard.
  narrationSrc?: string;
};

export type Shot = {
  shot_id: number;
  description: string;
  camera: string;
  // With narration, this is the sum of the shot's measured beat durations.
  // Without it, the Screenwriter's authored value, exactly as before.
  duration_s: number;
  beats?: Beat[];
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
