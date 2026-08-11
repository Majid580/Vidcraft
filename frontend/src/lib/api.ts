// Thin typed client over the backend REST API. Requests hit the Vite dev
// proxy at /api (vite.config.ts), which forwards to the Express backend on
// :5000. Override with VITE_API_URL in production builds.
//
// When `demo` is true, calls resolve from local sample data (lib/demo.ts)
// instead — used so the UI is fully explorable while the backend/ai-service
// stack is offline.

import type {
  AnalyzeResponse,
  ClarifyResponse,
  ImageProvider,
  RenderProvider,
  SingleImageResponse,
  StoryboardResponse,
} from './types'
import { demoAnalyze, demoClarify, demoStoryboard, demoSingleImage } from './demo'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  offline: boolean
  constructor(status: number, message: string, offline = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.offline = offline
  }
}

// 0 (fetch threw) and 502/503/504 (dev proxy can't reach :5000) all mean the
// backend stack isn't up — surface that as an "offline" error so the UI can
// offer Demo Mode instead of showing a raw status code.
const OFFLINE_STATUSES = new Set([0, 502, 503, 504])

async function request<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Backend not reachable on :5000.', true)
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }

  if (!res.ok) {
    if (OFFLINE_STATUSES.has(res.status)) {
      throw new ApiError(res.status, 'Backend not reachable on :5000.', true)
    }
    const msg =
      (data as { error?: string; message?: string })?.error ??
      (data as { message?: string })?.message ??
      `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }

  return data as T
}

export function analyzePrompt(prompt: string, demo = false) {
  return demo ? demoAnalyze(prompt) : request<AnalyzeResponse>('/prompts', { prompt })
}

export function clarifyPrompt(
  promptId: string,
  questions: string[],
  answers: string[],
  demo = false,
) {
  return demo
    ? demoClarify(answers)
    : request<ClarifyResponse>(`/prompts/${promptId}/clarify`, {
        questions,
        answers,
      })
}

export function generateStoryboard(
  promptId: string,
  styleTokens: string[] = [],
  renderProvider: RenderProvider = 'remotion',
  demo = false,
) {
  // styleTokens (FRONTEND-003) are sent in the payload so the ai-service can
  // seed world_state.style_tokens. The backend currently ignores the extra
  // field (see PROJECT_ARCHITECTURE.md §9 — full wiring is INTEG-001); demo
  // mode reflects them locally. renderProvider (ADR-020) IS consumed by the
  // real backend (BACKEND-006) — stamped onto every shot.
  return demo
    ? demoStoryboard(styleTokens, renderProvider)
    : request<StoryboardResponse>('/storyboards', {
        promptId,
        styleTokens,
        renderProvider,
      })
}

// Single-image mode: skips the Screenwriter/storyboard decomposition
// entirely (POST /api/images) — one enhanced-prompt-in, one image-out.
export function generateSingleImage(
  promptId: string,
  provider: ImageProvider,
  styleTokens: string[] = [],
  demo = false,
) {
  return demo
    ? demoSingleImage(promptId, provider, styleTokens)
    : request<SingleImageResponse>('/images', { promptId, provider, styleTokens })
}
