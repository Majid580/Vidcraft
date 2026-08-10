import { useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTilt } from '@/hooks/useTilt'

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
  const trimmed = value.trim()
  const canSubmit = trimmed.length >= 8 && !loading

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="glow-border brand-shadow tilt-3d animate-in-up rounded-2xl p-5 sm:p-6"
    >
      <label
        htmlFor="prompt"
        className="mb-3 flex items-center gap-2 text-sm font-medium"
      >
        <Wand2 className="size-4 text-primary" />
        Describe your scene
      </label>

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
        className="min-h-28 text-base"
      />

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
          className="brand-gradient h-11 gap-2 px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
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
