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

export interface Shot {
  shot_id: number
  description: string
  camera: string
  duration_s: number
  pathway: Pathway
  provider: RenderProvider
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  retry_count?: number
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
