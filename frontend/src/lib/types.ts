// Shared API types — mirror the backend REST contract
// (backend/src/routes/prompts.js, storyboards.js) and the ai-service
// analyzer schema (ai-service/analyzer/scoring.py).

export type DimensionKey =
  | 'subject_clarity'
  | 'action_specificity'
  | 'environment_detail'
  | 'visual_richness'
  | 'temporal_coherence'

export type Dimensions = Record<DimensionKey, number>

export interface Analysis {
  overall_score: number
  dimensions: Dimensions
  flags: string[]
  suggestions: string[]
}

export interface AnalyzeResponse {
  promptId: string
  analysis: Analysis
  clarificationQuestions?: string[]
}

// The ai-service returns `brief` as a structured object (e.g.
// {setting, style, lighting}) whose keys vary with the LLM output; older
// paths may return a plain string. Handle both.
export type Brief = string | Record<string, string>

export interface ClarifyResponse {
  clarifiedPrompt: string
  brief: Brief
}

export type Pathway = 'remotion' | 'external_api'

// FR-6 / ADR-020: the user picks exactly one of these, by name, before
// generation — no agent decides this anymore (Producer/Router, AI-005,
// is retired).
export type RenderProvider = 'remotion' | 'pollinations' | 'cloudflare' | 'huggingface'

// The subset of RenderProvider that can generate a single still image on
// demand (single-image mode, POST /api/images) — mirrors backend
// constants/renderProviders.js's IMAGE_PROVIDERS.
export type ImageProvider = 'pollinations' | 'cloudflare'

// Single-image mode skips the Screenwriter/storyboard shot decomposition
// entirely and generates exactly one image from the enhanced prompt;
// storyboard mode is the existing multi-shot flow (stills or video,
// depending on which RenderProvider is picked within it).
export type GenerationMode = 'single_image' | 'storyboard'

export type ShotStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  // 'on_hold' = deliberately not attempted (currently the huggingface video
  // provider, paused pending a paid key) — distinct from 'failed'.
  | 'on_hold'

export interface Shot {
  shot_id: number
  description: string
  camera: string
  duration_s: number
  pathway: Pathway
  provider: RenderProvider
  status?: ShotStatus
  retry_count?: number
  // Populated by generation (INTEG-001): the public /media URL of the
  // rendered/generated asset, and any per-shot error/hold message.
  asset_url?: string
  error?: string
}

export interface WorldState {
  characters: string[]
  setting: string
  style_tokens: string[]
  reference_image_url?: string
}

export interface StoryboardResponse {
  storyboardId: string
  status: string
  worldState: WorldState
  shots: Shot[]
}

// POST /api/storyboards/:id/generate response (INTEG-001, ADR-023) — async:
// returns a job handle, not the finished storyboard. Poll GET /api/jobs/:id.
export interface GenerateResponse {
  jobId: string
  storyboardId: string
  status: string
}

// GET /api/jobs/:id response (INTEG-001). `state` is the Bull job lifecycle
// (waiting | active | delayed | completed | failed | paused | stuck), plus our
// initial 'queued'; `progress` is 0–100; `shots` carries the live per-shot
// status/asset_url/error from the storyboard doc.
export interface JobStatus {
  jobId: string
  state: string
  progress: number
  storyboardId: string | null
  failedReason?: string
  shots: Shot[]
  // FR-9: the assembled final video — every generated shot concatenated into
  // one MP4, held for its own duration_s, with per-shot camera movement.
  // Absent until the run finishes. `videoError` is set when the per-shot
  // assets succeeded but the stitch itself didn't, which is a different (and
  // much less bad) outcome than the generation failing.
  videoUrl?: string
  videoError?: string
  // FR-9 post-processing (INTEG-002). Independently optional — post-processing
  // is best-effort per artifact and never touches the video above, so a run can
  // legitimately have a video with captions but no poster frame.
  // `thumbnailUrl` is the poster; `subtitlesUrl` is a WebVTT track the <video>
  // element can display natively; `subtitledVideoUrl` is a hardsubbed copy for
  // downloading (captions survive outside a captioning player).
  // `postprocessError` describes only what wasn't produced.
  thumbnailUrl?: string
  subtitlesUrl?: string
  subtitledVideoUrl?: string
  postprocessError?: string
}

// POST /api/images response (single-image mode) — no storyboard/shots,
// just the prompt before/after enhancement and the one generated image.
export interface SingleImageResponse {
  promptId: string
  provider: ImageProvider
  originalPrompt: string
  enhancedPrompt: string
  imageUrl: string
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  subject_clarity: 'Subject clarity',
  action_specificity: 'Action specificity',
  environment_detail: 'Environment detail',
  visual_richness: 'Visual richness',
  temporal_coherence: 'Temporal coherence',
}
