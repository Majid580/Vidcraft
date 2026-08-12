import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DIMENSION_LABELS, type Analysis, type DimensionKey } from '@/lib/types'

// FR-1 raises a flag on any dimension below 40 (ADR-010), so that threshold is
// the one place a status reading belongs — and it is carried by an icon and a
// word, never by colour alone.
const FLAG_THRESHOLD = 40

// Magnitude gets a sequential ramp: ONE hue, stepped light→dark. Not a
// traffic-light rainbow — the number already states the magnitude and the
// label already states the identity, so a third encoding in hue would be
// decoration competing with both.
function rampStep(value: number) {
  if (value >= 75) return 'var(--ramp-4)'
  if (value >= 50) return 'var(--ramp-3)'
  if (value >= 25) return 'var(--ramp-2)'
  return 'var(--ramp-1)'
}

// Counts to the real value once, on mount. The score is the headline number
// on this panel; arriving at it is worth 900ms of the reader's attention.
// Honours prefers-reduced-motion by landing on the value immediately.
function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    // Land on the real value immediately when we can't or shouldn't animate.
    // `document.hidden` matters as much as the motion preference: browsers do
    // not fire requestAnimationFrame in a background tab, so a panel that
    // mounts while hidden would otherwise sit at 0 — showing a confidently
    // wrong score — until the tab is focused.
    if (
      document.hidden ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setN(target)
      return
    }
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      // Same ease-out curve as the rest of the motion scale.
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, ms])
  return n
}

function ScoreRing({ score }: { score: number }) {
  const shown = useCountUp(score)
  const r = 36
  const c = 2 * Math.PI * r
  const dash = (shown / 100) * c

  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <svg viewBox="0 0 88 88" className="size-28 -rotate-90" aria-hidden="true">
        <defs>
          {/* The grade axis — warm to cool — used here and nowhere else at
              this size. One value, one arc, so a gradient reads as a single
              mark rather than as an encoding. */}
          <linearGradient id="gradeArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--mark-warm)" />
            <stop offset="100%" stopColor="var(--mark-cool)" />
          </linearGradient>
        </defs>
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 10%, transparent)"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="url(#gradeArc)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="data text-[30px] font-medium">{shown}</span>
        <span className="slate-label mt-1.5 text-[9px]">/ 100</span>
      </div>
    </div>
  )
}

function DimensionMeter({
  label,
  value,
  index,
}: {
  label: string
  value: number
  index: number
}) {
  const flagged = value < FLAG_THRESHOLD
  return (
    <div
      className="stage-in"
      style={{ '--i': index + 2 } as React.CSSProperties}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
          {label}
          {flagged && (
            <span className="text-warning inline-flex items-center gap-1 text-[11px]">
              <AlertTriangle className="size-3" />
              thin
            </span>
          )}
        </span>
        {/* Values wear text tokens, never the mark colour. */}
        <span className="data text-foreground text-[13px]">{value}</span>
      </div>
      {/* Thin mark, rounded data-end, anchored to the baseline; the track is
          a recessive surface rather than a competing colour. */}
      <div className="h-[6px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: rampStep(value),
            transition: 'width 0.9s var(--ease-out)',
          }}
        />
      </div>
    </div>
  )
}

export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  const strong = analysis.flags.length === 0
  const dims = Object.entries(analysis.dimensions) as [DimensionKey, number][]

  return (
    <Card className="plate-raised">
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={analysis.overall_score} />
          <div className="min-w-0">
            <div className="slate-label mb-1.5">Prompt analysis</div>
            <h3 className="font-display text-xl leading-tight font-semibold tracking-tight">
              {strong
                ? 'Strong prompt — ready to shoot.'
                : `${analysis.flags.length} area${analysis.flags.length > 1 ? 's' : ''} could be sharper.`}
            </h3>
            <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
              {strong
                ? 'Every dimension scored well. You can go straight to art direction.'
                : 'Answer the follow-up questions below and the brief gets rewritten with the detail that is missing.'}
            </p>
            <div className="mt-2.5">
              <Badge variant={strong ? 'cyan' : 'warning'}>
                {strong ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <AlertTriangle className="size-3" />
                )}
                {strong ? 'Clear' : 'Needs refinement'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {dims.map(([key, val], i) => (
            <DimensionMeter
              key={key}
              label={DIMENSION_LABELS[key]}
              value={val}
              index={i}
            />
          ))}
        </div>

        {analysis.suggestions.length > 0 && (
          <div className="plate-inset rounded-lg p-4">
            <div className="slate-label mb-2.5 flex items-center gap-1.5">
              <Lightbulb className="text-primary size-3.5" />
              Suggestions
            </div>
            <ul className="space-y-1.5">
              {analysis.suggestions.map((s, i) => (
                <li
                  key={i}
                  className="text-muted-foreground flex gap-2.5 text-[13px] leading-relaxed"
                >
                  <span className="data text-primary/70 mt-px text-[11px]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
