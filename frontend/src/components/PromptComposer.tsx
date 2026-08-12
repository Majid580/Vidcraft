import { useState } from 'react'
import { Loader2, Mic, Sparkles, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTilt } from '@/hooks/useTilt'
import { useDictation } from '@/hooks/useDictation'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  'A lone astronaut drifts past a glowing nebula, reaching toward a distant blue planet.',
  'A neon-lit Tokyo alley in the rain at night, steam rising, a cat watching from a doorway.',
  'A cozy autumn cabin at golden hour — leaves falling, smoke curling from the chimney.',
]

export function PromptComposer({
  onAnalyze,
  loading,
}: {
  onAnalyze: (prompt: string) => void
  loading: boolean
}) {
  const [value, setValue] = useState('')
  const tilt = useTilt(3)
  const dictation = useDictation({
    value,
    onChange: setValue,
    disabled: loading,
  })
  const trimmed = value.trim()
  const canSubmit = trimmed.length >= 8 && !loading

  // The composer is the primary object on the page, so it gets both the tilt
  // and the spotlight. They share one ref and one pointer handler rather than
  // each running their own — writing the position straight to the element
  // because this fires on every pointermove and re-rendering to move a
  // gradient sixty times a second would be absurd.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    tilt.onPointerMove(e)
    const el = tilt.ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={tilt.ref}
      onPointerMove={onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="plate plate-ruled spotlight tilt-3d animate-in-up rounded-xl p-5 sm:p-6"
    >
      <label
        htmlFor="prompt"
        className="mb-3 flex items-center gap-2 text-sm font-medium"
      >
        <Wand2 className="size-4 text-primary" />
        Describe your scene
      </label>

      <div className="relative">
        <Textarea
          id="prompt"
          rows={4}
          placeholder="e.g. A lone astronaut drifts past a glowing nebula toward a distant blue planet…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
              onAnalyze(trimmed)
            }
          }}
          disabled={loading}
          className={cn('min-h-28 text-base', dictation.supported && 'pr-14')}
        />

        {dictation.supported && (
          <button
            type="button"
            disabled={loading}
            aria-pressed={dictation.listening}
            aria-label={
              dictation.listening ? 'Release to stop dictation' : 'Hold to dictate'
            }
            title={dictation.listening ? 'Release to stop' : 'Hold to talk'}
            {...dictation.handlers}
            className={cn(
              'absolute right-3 bottom-3 grid size-9 touch-none place-items-center rounded-full border transition-all select-none disabled:pointer-events-none disabled:opacity-40',
              dictation.listening
                ? 'animate-pulse border-red-500/40 bg-red-500/15 text-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
                : 'border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <Mic className="size-4" />
          </button>
        )}
      </div>

      {(dictation.listening || dictation.errorMessage) && (
        <div className="mt-2 text-xs" aria-live="polite">
          {dictation.listening ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-500">
              <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
              Listening… keep holding, release the mic to stop
            </span>
          ) : (
            <span className="text-destructive">{dictation.errorMessage}</span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-1 text-xs">Try:</span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            disabled={loading}
            onClick={() => setValue(ex)}
            className="text-muted-foreground hover:text-foreground rounded-full border border-border bg-card/40 px-3 py-1 text-xs transition-colors hover:border-primary/50 disabled:opacity-50"
          >
            {['Space drift', 'Neon Tokyo', 'Autumn cabin'][i]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-xs tabular-nums">
          {trimmed.length} chars
          <span className="mx-2 opacity-40">·</span>
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
            ⌘↵
          </kbd>{' '}
          to analyze
        </span>

        <Button
          size="lg"
          disabled={!canSubmit}
          onClick={() => onAnalyze(trimmed)}
          className="bg-primary h-11 gap-2 px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Analyze prompt
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
