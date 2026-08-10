import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DIMENSION_LABELS, type Analysis, type DimensionKey } from '@/lib/types'

function scoreColor(score: number) {
  if (score >= 70) return 'oklch(0.72 0.16 160)' // green
  if (score >= 40) return 'oklch(0.78 0.15 85)' // amber
  return 'oklch(0.63 0.22 20)' // red
}

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="oklch(1 0 0 / 0.08)"
          strokeWidth="7"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums">{score}</span>
        <span className="text-muted-foreground text-[10px]">/ 100</span>
      </div>
    </div>
  )
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <div className="surface-2 h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: scoreColor(value),
            transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
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
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={analysis.overall_score} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Prompt analysis</h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {strong
                ? 'Strong prompt — ready to storyboard.'
                : `${analysis.flags.length} area${analysis.flags.length > 1 ? 's' : ''} could be clearer. Refine below for a better result.`}
            </p>
            <div className="mt-2">
              <Badge variant={strong ? 'success' : 'warning'}>
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

        <div className="grid gap-3 sm:grid-cols-2">
          {dims.map(([key, val]) => (
            <DimensionBar key={key} label={DIMENSION_LABELS[key]} value={val} />
          ))}
        </div>

        {analysis.suggestions.length > 0 && (
          <div className="surface-1 rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="size-4 text-[oklch(0.8_0.14_85)]" />
              Suggestions
            </div>
            <ul className="space-y-1.5">
              {analysis.suggestions.map((s, i) => (
                <li
                  key={i}
                  className="text-muted-foreground flex gap-2 text-sm"
                >
                  <span className="text-primary mt-0.5">•</span>
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
