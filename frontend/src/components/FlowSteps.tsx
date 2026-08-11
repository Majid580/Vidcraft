import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type Stage = 'compose' | 'refine' | 'style' | 'storyboard'

const ORDER: Stage[] = ['compose', 'refine', 'style', 'storyboard']

// Last step's label reflects the chosen generation mode — "Image" for
// single-image mode (no storyboard/shots involved), "Storyboard" otherwise.
export function FlowSteps({
  current,
  resultLabel = 'Storyboard',
}: {
  current: Stage
  resultLabel?: string
}) {
  const currentIdx = ORDER.indexOf(current)
  const steps = [
    { id: 'compose' as const, label: 'Compose' },
    { id: 'refine' as const, label: 'Refine' },
    { id: 'style' as const, label: 'Style' },
    { id: 'storyboard' as const, label: resultLabel },
  ]

  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-md">
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const state =
            i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'todo'
          return (
            <li key={step.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full border text-sm font-semibold transition-all',
                    state === 'done' &&
                      'brand-gradient border-transparent text-white',
                    state === 'active' &&
                      'border-primary/70 bg-primary/15 text-primary ring-4 ring-primary/10',
                    state === 'todo' &&
                      'border-border text-muted-foreground bg-card/50',
                  )}
                >
                  {state === 'done' ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium transition-colors',
                    state === 'todo'
                      ? 'text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'mx-2 h-px flex-1 -translate-y-2.5 transition-colors',
                    i < currentIdx ? 'bg-primary/60' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
