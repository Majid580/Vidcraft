import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type Stage = 'compose' | 'refine' | 'storyboard'

const STEPS: { id: Stage; label: string }[] = [
  { id: 'compose', label: 'Compose' },
  { id: 'refine', label: 'Refine' },
  { id: 'storyboard', label: 'Storyboard' },
]

const ORDER: Stage[] = ['compose', 'refine', 'storyboard']

export function FlowSteps({ current }: { current: Stage }) {
  const currentIdx = ORDER.indexOf(current)

  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-md">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
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
              {i < STEPS.length - 1 && (
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
