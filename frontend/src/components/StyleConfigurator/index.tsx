import { useState } from 'react'
import {
  ArrowRight,
  Check,
  Clapperboard,
  Droplets,
  Frame,
  Lightbulb,
  Loader2,
  Palette,
  Plus,
  Smile,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTilt } from '@/hooks/useTilt'
import { cn } from '@/lib/utils'
import {
  ASPECTS,
  LIGHTING,
  MOODS,
  PALETTES,
  RENDER_PROVIDERS,
  VISUAL_STYLES,
  toStyleTokens,
  type RenderProviderOption,
  type StyleConfig,
  type StyleOption,
} from './styleOptions'

const MAX_LIGHTING = 3
const MAX_CUSTOM = 6

// ── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint: string
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-primary size-4" />
        {title}
      </h4>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  )
}

// ── Selectable option tile (icon + label) ───────────────────────────────────
function OptionTile({
  option,
  selected,
  index,
  onClick,
}: {
  option: StyleOption
  selected: boolean
  index: number
  onClick: () => void
}) {
  const Icon = option.icon
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        'tile-in card-3d-pop group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left',
        selected
          ? 'glow-border brand-shadow border-transparent'
          : 'border-border bg-card/40 hover:border-primary/40',
      )}
    >
      <span
        className={cn(
          'grid size-9 place-items-center rounded-lg transition-all duration-300',
          selected
            ? 'brand-gradient text-white shadow-lg'
            : 'surface-2 text-muted-foreground group-hover:text-primary',
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{option.label}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {option.hint}
        </span>
      </span>
      {selected && (
        <span className="brand-gradient animate-pop absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-white shadow-md">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

// ── Render-provider tile (ADR-020: user picks free Remotion or a named,
// small-real-cost provider — no agent decides this) ────────────────────────
function ProviderTile({
  option,
  selected,
  index,
  onClick,
}: {
  option: RenderProviderOption
  selected: boolean
  index: number
  onClick: () => void
}) {
  const Icon = option.icon
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        'tile-in card-3d-pop group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left',
        selected
          ? 'glow-border brand-shadow border-transparent'
          : 'border-border bg-card/40 hover:border-primary/40',
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={cn(
            'grid size-9 place-items-center rounded-lg transition-all duration-300',
            selected
              ? 'brand-gradient text-white shadow-lg'
              : 'surface-2 text-muted-foreground group-hover:text-primary',
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <Badge
          variant={option.cost === 'free' ? 'success' : 'warning'}
          className="shrink-0 text-[10px]"
        >
          {option.costLabel}
        </Badge>
      </div>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{option.label}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {option.hint}
        </span>
      </span>
      {selected && (
        <span className="brand-gradient animate-pop absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-white shadow-md">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

// ── 3D palette orb ──────────────────────────────────────────────────────────
function PaletteOrb({
  colors,
  label,
  selected,
  index,
  onClick,
}: {
  colors: string[]
  label: string
  selected: boolean
  index: number
  onClick: () => void
}) {
  const gradient = `conic-gradient(from 210deg, ${colors.join(', ')}, ${colors[0]})`
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        'tile-in card-3d-pop flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 transition-all',
        selected
          ? 'glow-border brand-shadow border-transparent'
          : 'border-border bg-card/40 hover:border-primary/40',
      )}
    >
      <span
        className="relative size-12 rounded-full shadow-lg ring-1 ring-black/10"
        style={{ backgroundImage: gradient }}
      >
        {/* glossy 3D highlight */}
        <span className="absolute left-1.5 top-1 size-4 rounded-full bg-white/55 blur-[3px]" />
        {selected && (
          <span className="animate-pop bg-background/90 absolute inset-0 m-auto grid size-5 place-items-center rounded-full shadow">
            <Check className="text-primary size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

// ── 3D aspect-ratio frame ───────────────────────────────────────────────────
function AspectFrame({
  ratio,
  label,
  hint,
  selected,
  index,
  onClick,
}: {
  ratio: number
  label: string
  hint: string
  selected: boolean
  index: number
  onClick: () => void
}) {
  // Fit the frame inside a 44x36 box while preserving the ratio.
  const maxW = 44
  const maxH = 34
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        'tile-in card-3d-pop flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-all',
        selected
          ? 'glow-border brand-shadow border-transparent'
          : 'border-border bg-card/40 hover:border-primary/40',
      )}
    >
      <span className="grid h-9 w-full place-items-center">
        <span
          className={cn(
            'rounded-[3px] border-2 transition-all duration-300',
            selected
              ? 'brand-gradient border-transparent shadow-md'
              : 'border-muted-foreground/50 group-hover:border-primary',
          )}
          style={{ width: w, height: h }}
        />
      </span>
      <span className="text-center">
        <span className="block text-xs font-medium">{label}</span>
        <span className="text-muted-foreground block text-[10px] tabular-nums">
          {hint}
        </span>
      </span>
    </button>
  )
}

// ── Main configurator ───────────────────────────────────────────────────────
export function StyleConfigurator({
  config,
  onChange,
  onGenerate,
  loading,
}: {
  config: StyleConfig
  onChange: (next: StyleConfig) => void
  onGenerate: () => void
  loading: boolean
}) {
  const tilt = useTilt(2.5)
  const [customDraft, setCustomDraft] = useState('')

  const tokens = toStyleTokens(config)

  const setVisual = (id: string) =>
    onChange({ ...config, visualStyle: config.visualStyle === id ? null : id })
  const setMood = (id: string) =>
    onChange({ ...config, mood: config.mood === id ? null : id })
  const toggleLighting = (id: string) => {
    const has = config.lighting.includes(id)
    if (!has && config.lighting.length >= MAX_LIGHTING) return
    onChange({
      ...config,
      lighting: has
        ? config.lighting.filter((l) => l !== id)
        : [...config.lighting, id],
    })
  }
  const setPalette = (id: string) => onChange({ ...config, palette: id })
  const setAspect = (id: string) => onChange({ ...config, aspectRatio: id })
  const setRenderProvider = (id: RenderProviderOption['id']) =>
    onChange({ ...config, renderProvider: id })

  const selectedProvider = RENDER_PROVIDERS.find(
    (p) => p.id === config.renderProvider,
  )

  const addCustom = () => {
    const v = customDraft.trim().toLowerCase()
    if (!v || config.custom.includes(v) || config.custom.length >= MAX_CUSTOM)
      return
    onChange({ ...config, custom: [...config.custom, v] })
    setCustomDraft('')
  }
  const removeCustom = (t: string) =>
    onChange({ ...config, custom: config.custom.filter((c) => c !== t) })

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="glass tilt-3d overflow-hidden rounded-2xl"
    >
      {/* Header */}
      <div className="border-border/60 relative border-b px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="brand-gradient animate-float grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-lg">
            <Wand2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">
              Art-direct your video
            </h3>
            <p className="text-muted-foreground text-sm">
              Choose the look and feel — these style tokens ground every shot.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-7 px-5 py-6 sm:px-6">
        {/* Visual style */}
        <section>
          <SectionHeading
            icon={Clapperboard}
            title="Visual style"
            hint="pick one"
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {VISUAL_STYLES.map((o, i) => (
              <OptionTile
                key={o.id}
                option={o}
                index={i}
                selected={config.visualStyle === o.id}
                onClick={() => setVisual(o.id)}
              />
            ))}
          </div>
        </section>

        {/* Mood */}
        <section>
          <SectionHeading icon={Smile} title="Mood & tone" hint="optional" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {MOODS.map((o, i) => (
              <OptionTile
                key={o.id}
                option={o}
                index={i}
                selected={config.mood === o.id}
                onClick={() => setMood(o.id)}
              />
            ))}
          </div>
        </section>

        {/* Lighting */}
        <section>
          <SectionHeading
            icon={Lightbulb}
            title="Lighting"
            hint={`${config.lighting.length}/${MAX_LIGHTING} selected`}
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {LIGHTING.map((o, i) => (
              <OptionTile
                key={o.id}
                option={o}
                index={i}
                selected={config.lighting.includes(o.id)}
                onClick={() => toggleLighting(o.id)}
              />
            ))}
          </div>
        </section>

        {/* Palette + Aspect ratio side by side on wide screens */}
        <div className="grid gap-7 lg:grid-cols-2">
          <section>
            <SectionHeading icon={Palette} title="Color palette" hint="pick one" />
            <div className="flex flex-wrap gap-2.5">
              {PALETTES.map((p, i) => (
                <PaletteOrb
                  key={p.id}
                  colors={p.colors}
                  label={p.label}
                  index={i}
                  selected={config.palette === p.id}
                  onClick={() => setPalette(p.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionHeading icon={Frame} title="Aspect ratio" hint="pick one" />
            <div className="flex gap-2.5">
              {ASPECTS.map((a, i) => (
                <AspectFrame
                  key={a.id}
                  ratio={a.ratio}
                  label={a.label}
                  hint={a.hint}
                  index={i}
                  selected={config.aspectRatio === a.id}
                  onClick={() => setAspect(a.id)}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Rendering method (ADR-020): user picks the pathway/provider
            explicitly — Remotion (free) or a named paid-but-cheap provider.
            No agent decides this. */}
        <section>
          <SectionHeading
            icon={Zap}
            title="Rendering method"
            hint="pick one — Remotion is always free"
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {RENDER_PROVIDERS.map((o, i) => (
              <ProviderTile
                key={o.id}
                option={o}
                index={i}
                selected={config.renderProvider === o.id}
                onClick={() => setRenderProvider(o.id)}
              />
            ))}
          </div>
          {selectedProvider && selectedProvider.cost === 'paid' && (
            <p className="text-muted-foreground mt-2.5 text-xs">
              {selectedProvider.label} costs a small real amount per
              generation ({selectedProvider.costLabel}) — this isn't
              production software, so you're choosing this deliberately.
            </p>
          )}
        </section>

        {/* Custom tokens */}
        <section>
          <SectionHeading
            icon={Droplets}
            title="Custom tokens"
            hint={`${config.custom.length}/${MAX_CUSTOM}`}
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
              placeholder="e.g. lens flare, 35mm film grain…"
              maxLength={40}
              className="border-input bg-card/40 placeholder:text-muted-foreground focus:border-primary/60 focus:ring-primary/20 h-10 flex-1 rounded-xl border px-3.5 text-sm outline-none transition-colors focus:ring-4"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addCustom}
              disabled={
                !customDraft.trim() || config.custom.length >= MAX_CUSTOM
              }
              className="h-10 shrink-0 gap-1.5"
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          {config.custom.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {config.custom.map((t) => (
                <span
                  key={t}
                  className="surface-2 animate-pop text-foreground/90 inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove ${t}`}
                    onClick={() => removeCustom(t)}
                    className="hover:bg-foreground/10 grid size-4 place-items-center rounded-full transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Summary + generate CTA */}
      <div className="glow-border brand-shadow m-3 flex flex-col gap-4 rounded-2xl p-5 sm:m-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              {tokens.length} style {tokens.length === 1 ? 'token' : 'tokens'}
            </span>
            {selectedProvider && (
              <span className="flex items-center gap-1.5">
                <Zap className="size-3.5" />
                Rendering via {selectedProvider.label}
                <Badge
                  variant={selectedProvider.cost === 'free' ? 'success' : 'warning'}
                  className="text-[10px]"
                >
                  {selectedProvider.costLabel}
                </Badge>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tokens.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                Nothing selected yet — pick a style above.
              </span>
            ) : (
              tokens.map((t) => (
                <Badge key={t} variant="violet" className="capitalize">
                  {t}
                </Badge>
              ))
            )}
          </div>
        </div>
        <Button
          size="lg"
          disabled={loading}
          onClick={onGenerate}
          className="brand-gradient h-11 shrink-0 gap-2 px-6 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate storyboard
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
