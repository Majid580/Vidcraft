import { Mic } from 'lucide-react'

import { useDictation } from '@/hooks/useDictation'
import { cn } from '@/lib/utils'

// Self-contained press-and-hold dictation mic bound to one text field. Renders
// nothing on browsers without the Web Speech API. Hold (mouse/touch) or hold
// Space/Enter to talk; recognized speech streams into the field via
// onValueChange. State is shown by the mic's own pulse/colour + title/aria —
// callers that want a status line (e.g. permission errors) should use
// useDictation directly instead.
export function DictationMic({
  value,
  onValueChange,
  disabled,
  className,
}: {
  value: string
  onValueChange: (next: string) => void
  disabled?: boolean
  className?: string
}) {
  const dict = useDictation({ value, onChange: onValueChange, disabled })
  if (!dict.supported) return null

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={dict.listening}
      aria-label={
        dict.listening ? 'Release to stop dictation' : 'Hold to dictate'
      }
      title={dict.listening ? 'Release to stop' : 'Hold to talk'}
      {...dict.handlers}
      className={cn(
        'grid size-9 shrink-0 touch-none place-items-center rounded-full border transition-all select-none disabled:pointer-events-none disabled:opacity-40',
        dict.listening
          ? 'animate-pulse border-red-500/40 bg-red-500/15 text-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
          : 'border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
        className,
      )}
    >
      <Mic className="size-4" />
    </button>
  )
}
