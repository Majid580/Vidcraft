// Style-configurator option catalog (FRONTEND-003).
//
// Each selection ultimately flattens into a flat `style_tokens: string[]`
// (see toStyleTokens below) which is what the ai-service orchestrator consumes
// on world_state.style_tokens. Keeping the option catalog declarative here lets
// the UI stay a pure render of this data.

import {
  Brush,
  Building2,
  Camera,
  Clapperboard,
  Cloud,
  Contrast,
  Feather,
  Flame,
  Film,
  Ghost,
  ImageIcon,
  Images,
  Lightbulb,
  Moon,
  Boxes,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { GenerationMode, RenderProvider } from '@/lib/types'

export interface StyleOption {
  /** The literal token pushed into style_tokens. */
  id: string
  label: string
  /** Short helper shown under the label. */
  hint: string
  icon: LucideIcon
}

export interface PaletteOption {
  id: string
  label: string
  /** Swatch stops (left→right) rendered as the 3D orb / chips. */
  colors: string[]
  /** Tokens contributed when this palette is chosen. */
  tokens: string[]
}

export interface AspectOption {
  id: string
  label: string
  hint: string
  /** width / height, used to draw the little 3D frame. */
  ratio: number
}

// ── Visual style (single-select aesthetic) ──────────────────────────────────
export const VISUAL_STYLES: StyleOption[] = [
  { id: 'cinematic', label: 'Cinematic', hint: 'Filmic, wide dynamic range', icon: Clapperboard },
  { id: 'photorealistic', label: 'Photoreal', hint: 'Live-action, true-to-life', icon: Camera },
  { id: '3d render', label: '3D Render', hint: 'CGI, ray-traced depth', icon: Boxes },
  { id: 'anime', label: 'Anime', hint: 'Stylized, hand-drawn cels', icon: Sparkles },
  { id: 'cyberpunk', label: 'Cyberpunk', hint: 'Neon dystopia, high tech', icon: Zap },
  { id: 'film noir', label: 'Film Noir', hint: 'High-contrast monochrome', icon: Contrast },
  { id: 'watercolor', label: 'Watercolor', hint: 'Soft painterly washes', icon: Brush },
  { id: 'vaporwave', label: 'Vaporwave', hint: 'Retro pastel synth', icon: Sunset },
]

// ── Mood / tone (single-select) ─────────────────────────────────────────────
export const MOODS: StyleOption[] = [
  { id: 'epic', label: 'Epic', hint: 'Grand, sweeping scale', icon: Flame },
  { id: 'serene', label: 'Serene', hint: 'Calm, tranquil', icon: Feather },
  { id: 'mysterious', label: 'Mysterious', hint: 'Moody, enigmatic', icon: Ghost },
  { id: 'playful', label: 'Playful', hint: 'Bright, whimsical', icon: Sparkles },
  { id: 'dramatic', label: 'Dramatic', hint: 'Tense, high-stakes', icon: Zap },
  { id: 'urban', label: 'Urban', hint: 'Gritty, metropolitan', icon: Building2 },
]

// ── Lighting (multi-select) ─────────────────────────────────────────────────
export const LIGHTING: StyleOption[] = [
  { id: 'golden hour', label: 'Golden hour', hint: 'Warm low sun', icon: Sunrise },
  { id: 'volumetric light', label: 'Volumetric', hint: 'God rays, haze', icon: Lightbulb },
  { id: 'neon glow', label: 'Neon glow', hint: 'Saturated rim light', icon: Zap },
  { id: 'soft diffused', label: 'Soft & diffused', hint: 'Even, gentle', icon: Cloud },
  { id: 'low-key moody', label: 'Low-key', hint: 'Deep shadows', icon: Moon },
  { id: 'backlit', label: 'Backlit', hint: 'Silhouette, halo', icon: Sun },
]

// ── Color palette (single-select) ───────────────────────────────────────────
export const PALETTES: PaletteOption[] = [
  {
    id: 'violet-cyan',
    label: 'Violet & Cyan',
    colors: ['#a855f7', '#6366f1', '#22d3ee'],
    tokens: ['violet & cyan palette'],
  },
  {
    id: 'warm-sunset',
    label: 'Warm Sunset',
    colors: ['#f97316', '#ec4899', '#a855f7'],
    tokens: ['warm sunset palette'],
  },
  {
    id: 'cool-ocean',
    label: 'Cool Ocean',
    colors: ['#0ea5e9', '#22d3ee', '#2dd4bf'],
    tokens: ['cool ocean palette'],
  },
  {
    id: 'neon-night',
    label: 'Neon Night',
    colors: ['#d946ef', '#8b5cf6', '#06b6d4'],
    tokens: ['neon night palette'],
  },
  {
    id: 'earthy',
    label: 'Earthy Natural',
    colors: ['#84cc16', '#ca8a04', '#78350f'],
    tokens: ['earthy natural palette'],
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    colors: ['#e5e7eb', '#9ca3af', '#374151'],
    tokens: ['monochrome palette'],
  },
]

// ── Generation mode (single-select) ─────────────────────────────────────────
// Single image skips the Screenwriter/storyboard shot decomposition
// entirely and generates exactly one image from the enhanced prompt
// (POST /api/images); storyboard is the existing multi-shot flow — stills
// or video, depending on which RenderProvider is picked within it.
export interface GenerationModeOption {
  id: GenerationMode
  label: string
  hint: string
  icon: LucideIcon
}

export const GENERATION_MODES: GenerationModeOption[] = [
  {
    id: 'single_image',
    label: 'Single image',
    hint: 'One enhanced-prompt image, no shots',
    icon: ImageIcon,
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    hint: 'Multi-shot — stills or video',
    icon: Images,
  },
]

// Providers valid for single-image mode — Remotion needs a shot to render
// and Hugging Face is video-only, so neither applies (mirrors backend
// constants/renderProviders.js's IMAGE_PROVIDERS).
export const IMAGE_PROVIDER_IDS: RenderProvider[] = ['pollinations', 'cloudflare']

// ── Rendering provider (single-select, ADR-020) ─────────────────────────────
// The user's explicit choice of how the video is actually rendered — no
// agent decides this (Producer/Router, AI-005, is retired). Remotion is the
// permanent free tier; the rest are named, real providers wired up in
// BACKEND-005, each with a small real cost.
export interface RenderProviderOption {
  id: RenderProvider
  label: string
  hint: string
  cost: 'free' | 'paid'
  costLabel: string
  icon: LucideIcon
}

export const RENDER_PROVIDERS: RenderProviderOption[] = [
  {
    id: 'remotion',
    label: 'Remotion',
    hint: 'Code-driven, stylized/animated',
    cost: 'free',
    costLabel: 'Free',
    icon: Film,
  },
  {
    id: 'pollinations',
    label: 'Pollinations',
    hint: 'Photoreal image, no account',
    cost: 'free',
    costLabel: 'Free',
    icon: ImageIcon,
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    hint: 'Photoreal image (FLUX)',
    cost: 'free',
    costLabel: 'Free tier',
    icon: Sparkles,
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    hint: 'Photoreal video (Wan 2.1)',
    cost: 'paid',
    costLabel: '~$0.05–$0.20',
    icon: Camera,
  },
]

// ── Aspect ratio (single-select) ────────────────────────────────────────────
export const ASPECTS: AspectOption[] = [
  { id: '16:9', label: 'Landscape', hint: '16 : 9', ratio: 16 / 9 },
  { id: '9:16', label: 'Vertical', hint: '9 : 16', ratio: 9 / 16 },
  { id: '1:1', label: 'Square', hint: '1 : 1', ratio: 1 },
  { id: '2.39:1', label: 'Cinemascope', hint: '2.39 : 1', ratio: 2.39 },
]

export interface StyleConfig {
  mode: GenerationMode
  visualStyle: string | null
  mood: string | null
  lighting: string[]
  palette: string
  aspectRatio: string
  custom: string[]
  renderProvider: RenderProvider
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  mode: 'storyboard',
  visualStyle: 'cinematic',
  mood: null,
  lighting: [],
  palette: 'violet-cyan',
  aspectRatio: '16:9',
  custom: [],
  renderProvider: 'remotion',
}

/**
 * Flatten a StyleConfig into the flat `style_tokens` array the backend /
 * ai-service consume. Aspect ratio is emitted as an `aspect:` token so it
 * survives the round-trip without colliding with descriptive style tokens.
 */
export function toStyleTokens(cfg: StyleConfig): string[] {
  const tokens: string[] = []
  if (cfg.visualStyle) tokens.push(cfg.visualStyle)
  if (cfg.mood) tokens.push(cfg.mood)
  tokens.push(...cfg.lighting)
  const pal = PALETTES.find((p) => p.id === cfg.palette)
  if (pal) tokens.push(...pal.tokens)
  tokens.push(...cfg.custom)
  if (cfg.aspectRatio) tokens.push(`aspect:${cfg.aspectRatio}`)
  return tokens
}
