// Sample-data generators for Demo Mode. These produce clearly-labeled
// placeholder responses so the full UI flow is explorable when the backend
// stack (:5000 + ai-service) isn't running. NOT real model output — the UI
// surfaces a visible "Demo mode" badge whenever this path is used.

import type {
  AnalyzeResponse,
  ClarifyResponse,
  Dimensions,
  GenerateResponse,
  ImageProvider,
  JobStatus,
  RenderProvider,
  Shot,
  SingleImageResponse,
  StoryboardResponse,
} from './types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const VAGUE_VERBS = ['moves', 'goes', 'does', 'is', 'has', 'walks', 'runs']
const TIME_WORDS = ['morning', 'noon', 'night', 'dawn', 'dusk', 'sunset', 'sunrise', 'golden hour']

function clamp(n: number) {
  return Math.max(8, Math.min(96, Math.round(n)))
}

function scorePrompt(prompt: string): Dimensions {
  const words = prompt.toLowerCase().split(/\s+/).filter(Boolean)
  const len = words.length
  const adjectives = words.filter((w) => w.length > 6).length
  const hasVague = words.some((w) => VAGUE_VERBS.includes(w))
  const hasTime = words.some((w) => TIME_WORDS.includes(w))
  const hasPlace = /(in|at|on|inside|outside|near)\s/.test(prompt.toLowerCase())

  return {
    subject_clarity: clamp(40 + len * 3),
    action_specificity: clamp(hasVague ? 30 : 55 + len * 2),
    environment_detail: clamp(hasPlace ? 68 : 34),
    visual_richness: clamp(35 + adjectives * 12),
    temporal_coherence: clamp(hasTime ? 74 : 38),
  }
}

export async function demoAnalyze(prompt: string): Promise<AnalyzeResponse> {
  await delay(700)
  const dimensions = scorePrompt(prompt)
  const overall = Math.round(
    Object.values(dimensions).reduce((a, b) => a + b, 0) / 5,
  )

  const flags: string[] = []
  const suggestions: string[] = []
  const questions: string[] = []

  if (dimensions.environment_detail < 40) {
    flags.push('missing_setting')
    suggestions.push('Specify where the scene takes place (indoor/outdoor, time of day).')
    questions.push('Where does this scene take place, and what time of day is it?')
  }
  if (dimensions.visual_richness < 40) {
    flags.push('low_visual_detail')
    suggestions.push('Add more descriptive adjectives to convey the visual style.')
    questions.push('What visual style or mood are you going for (colors, lighting, tone)?')
  }
  if (dimensions.temporal_coherence < 40) {
    flags.push('temporal_ambiguity')
    suggestions.push("Clarify the order or timing of events (e.g. 'before', 'after', 'then').")
  }

  return {
    promptId: `demo-${Date.now()}`,
    analysis: { overall_score: overall, dimensions, flags, suggestions },
    ...(questions.length ? { clarificationQuestions: questions.slice(0, 2) } : {}),
  }
}

export async function demoClarify(answers: string[]): Promise<ClarifyResponse> {
  await delay(650)
  const detail = answers.find((a) => a.trim())?.trim()
  return {
    // Mirrors the real ai-service shape: a structured brief object.
    brief: {
      setting: detail || 'deep space near a luminous nebula, dusk light',
      style: 'cinematic, atmospheric',
      lighting: 'volumetric, violet & cyan',
    },
    clarifiedPrompt:
      'A lone astronaut drifts weightlessly past a luminous violet nebula at deep dusk, ' +
      'slowly reaching toward a distant glowing blue planet, cinematic wide shot, volumetric light.',
  }
}

// Single-image mode's sample response — a generated SVG placeholder (no
// real network call, no real provider), same spirit as the rest of this
// file's fabricated-but-labeled data.
export async function demoSingleImage(
  promptId: string,
  provider: ImageProvider,
  styleTokens: string[] = [],
): Promise<SingleImageResponse> {
  await delay(900)
  const originalPrompt = 'A lone astronaut drifts past a glowing nebula.'
  const chosen = styleTokens.filter((t) => !t.startsWith('aspect:'))
  const enhancedPrompt = [
    'A lone astronaut in a weathered EVA suit drifts weightlessly past a luminous violet ' +
      'nebula at deep dusk, cinematic wide shot, volumetric light.',
    ...chosen,
  ].join(', ')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient></defs>
    <rect width="768" height="768" fill="url(#g)"/>
    <text x="50%" y="48%" text-anchor="middle" fill="white" font-size="28" font-family="sans-serif">Demo mode</text>
    <text x="50%" y="56%" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif">(${provider}, no real generation)</text>
  </svg>`

  return {
    promptId,
    provider,
    originalPrompt,
    enhancedPrompt,
    imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  }
}

// Demo-mode generation (INTEG-001): simulates the async POST /generate +
// GET /api/jobs/:id loop entirely client-side, so the storyboard's shots
// "generate" over a few seconds with labeled SVG placeholders — driven by the
// exact same poll code path App uses against the real backend.
interface DemoJob {
  startedAt: number
  shots: Shot[]
}
const demoJobs = new Map<string, DemoJob>()
const DEMO_PER_SHOT_MS = 1100

function demoShotAsset(shot: Shot): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <text x="50%" y="46%" text-anchor="middle" fill="white" font-size="22" font-family="sans-serif">Shot ${shot.shot_id} · Demo</text>
    <text x="50%" y="56%" text-anchor="middle" fill="white" font-size="13" font-family="sans-serif" opacity="0.85">(${shot.provider}, no real generation)</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export async function demoStartGeneration(shots: Shot[]): Promise<GenerateResponse> {
  await delay(300)
  const jobId = `demo-job-${Date.now()}`
  demoJobs.set(jobId, {
    startedAt: Date.now(),
    shots: shots.map((s): Shot => ({ ...s, status: 'pending', asset_url: undefined, error: undefined })),
  })
  return { jobId, storyboardId: 'demo', status: 'queued' }
}

export async function demoGetJob(jobId: string): Promise<JobStatus> {
  await delay(200)
  const job = demoJobs.get(jobId)
  if (!job) return { jobId, state: 'completed', progress: 100, storyboardId: 'demo', shots: [] }

  const total = job.shots.length || 1
  const done = Math.min(job.shots.length, Math.floor((Date.now() - job.startedAt) / DEMO_PER_SHOT_MS))
  const shots = job.shots.map((s, i): Shot => {
    if (i < done) {
      // huggingface (video) is deliberately held — mirror the real backend.
      if (s.provider === 'huggingface')
        return { ...s, status: 'on_hold', error: 'Video generation is on hold (demo) pending a paid key.' }
      return { ...s, status: 'completed', asset_url: demoShotAsset(s) }
    }
    if (i === done) return { ...s, status: 'processing' }
    return { ...s, status: 'pending' }
  })
  const state = done >= job.shots.length ? 'completed' : 'active'
  return { jobId, state, progress: Math.round((done / total) * 100), storyboardId: 'demo', shots }
}

export async function demoStoryboard(
  styleTokens: string[] = [],
  renderProvider: RenderProvider = 'remotion',
): Promise<StoryboardResponse> {
  await delay(900)
  // Reflect the configurator's picks (FRONTEND-003) in world_state; fall back
  // to the canonical sample tokens when nothing was chosen.
  const chosen = styleTokens.filter((t) => !t.startsWith('aspect:'))
  const style_tokens = chosen.length
    ? chosen
    : ['cinematic', 'volumetric light', 'violet & cyan', 'photorealistic']
  // ADR-020: every shot gets the same user-picked provider — no agent
  // decides pathway per shot anymore.
  const pathway = renderProvider === 'remotion' ? 'remotion' : 'external_api'
  return {
    storyboardId: `demo-sb-${Date.now()}`,
    status: 'completed',
    worldState: {
      characters: ['Astronaut'],
      setting: 'Deep space near a luminous nebula, dusk light',
      style_tokens,
    },
    shots: [
      {
        shot_id: 1,
        description:
          'Wide establishing shot: the astronaut drifts weightlessly, silhouetted against a vast glowing violet nebula.',
        camera: 'wide shot, slow dolly-in',
        duration_s: 4,
        pathway,
        provider: renderProvider,
      },
      {
        shot_id: 2,
        description:
          'Medium shot on the visor reflection catching the distant blue planet as the astronaut turns.',
        camera: 'medium shot, gentle arc',
        duration_s: 3,
        pathway,
        provider: renderProvider,
      },
      {
        shot_id: 3,
        description:
          'Close-up of a gloved hand reaching toward the planet, cyan rim-light tracing the fingertips.',
        camera: 'close-up, shallow depth of field',
        duration_s: 3,
        pathway,
        provider: renderProvider,
      },
    ],
  }
}
