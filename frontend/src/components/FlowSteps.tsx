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
              <div className="flex flex-col items-center gap-2">
                {/* Square markers with monospaced numbers, not round numbered
                    pills: this is a production sequence and should read like
                    one. */}
                <span
                  className={cn(
                    'data grid size-7 place-items-center rounded-[4px] border text-[11px] transition-all duration-300',
                    state === 'done' &&
                      'border-accent/60 bg-accent/15 text-accent',
                    state === 'active' &&
                      'border-primary/70 bg-primary/15 text-primary pulse-active',
                    state === 'todo' && 'border-border text-muted-foreground/60',
                  )}
                  aria-current={state === 'active' ? 'step' : undefined}
                >
                  {state === 'done' ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <span
                  className={cn(
                    'font-display text-[13px] leading-none font-medium tracking-wide transition-colors duration-300',
                    state === 'todo'
                      ? 'text-muted-foreground/70'
                      : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'mx-2.5 h-px flex-1 -translate-y-[13px] transition-colors duration-500',
                    i < currentIdx ? 'bg-accent/50' : 'bg-border',
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
