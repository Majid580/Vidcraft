import { useCallback, useEffect, useRef } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { useSpeechRecognition } from './useSpeechRecognition'

// Append dictated speech after the text that was already in the field when the
// mic was pressed, collapsing the seam to a single space so we never produce
// leading/trailing/double spaces.
function mergeSpoken(base: string, spoken: string): string {
  const b = base.trimEnd()
  const s = spoken.trim()
  if (!s) return base
  if (!b) return s
  return `${b} ${s}`
}

// Friendly, non-scary copy for the recognizer error codes worth surfacing.
function micErrorMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'not-allowed' || code === 'service-not-allowed')
    return 'Microphone access was blocked. Allow it in your browser to dictate.'
  if (code === 'no-speech') return "Didn't catch that — try again."
  if (code === 'audio-capture')
    return 'No microphone found. Check your device and try again.'
  return null
}

export interface DictationHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void
  onKeyUp: (e: ReactKeyboardEvent<HTMLButtonElement>) => void
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void
}

export interface UseDictation {
  supported: boolean
  listening: boolean
  errorMessage: string | null
  /** Spread onto the mic <button> — implements press-and-hold (talk while held). */
  handlers: DictationHandlers
}

// Press-and-hold ("walkie-talkie") dictation bound to a single text field.
// Speech recognized while the mic is held streams live into the field (via
// onChange); releasing stops. Keyboard users get the same behaviour by holding
// Space/Enter. All recognizer mechanics live in useSpeechRecognition — this
// layer only owns the hold gesture and the merge-into-field wiring.
export function useDictation({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}): UseDictation {
  const sr = useSpeechRecognition()
  // Field text at the moment the mic was pressed; spoken words are appended
  // after it so we don't clobber what the user already typed.
  const baseRef = useRef('')
  // Keep the latest onChange/value without re-subscribing the stream effect.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value

  // Stream recognized speech into the field live (interim + final).
  useEffect(() => {
    if (!sr.listening && !sr.transcript) return
    onChangeRef.current(
      mergeSpoken(baseRef.current, `${sr.transcript} ${sr.interim}`),
    )
  }, [sr.listening, sr.transcript, sr.interim])

  const begin = useCallback(() => {
    if (disabled || sr.listening) return
    baseRef.current = valueRef.current
    sr.reset()
    sr.start()
  }, [disabled, sr])

  const end = useCallback(() => {
    if (sr.listening) sr.stop()
  }, [sr])

  const handlers: DictationHandlers = {
    onPointerDown: (e) => {
      // preventDefault keeps the press from stealing focus / selecting text;
      // pointer capture makes the matching pointerup land on us even if the
      // finger/cursor drifts off the button before release. Capture can throw
      // (InvalidPointerId) in edge cases — a failure there must not abort the
      // press, so guard it.
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* pointer capture is best-effort */
      }
      begin()
    },
    onPointerUp: (e) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      end()
    },
    onPointerCancel: () => end(),
    onKeyDown: (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        begin()
      }
    },
    onKeyUp: (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        end()
      }
    },
    onContextMenu: (e) => e.preventDefault(),
  }

  return {
    supported: sr.supported,
    listening: sr.listening,
    errorMessage: micErrorMessage(sr.error),
    handlers,
  }
}
