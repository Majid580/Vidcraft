import { useCallback, useEffect, useRef, useState } from 'react'

// Streaming speech-to-text via the browser's Web Speech API
// (SpeechRecognition / webkitSpeechRecognition). Transcription runs on the
// browser vendor's cloud in Chrome/Edge — no local model, no backend, no API
// key, and it does not consume the project's Groq quota (ADR-015 friendly).
// Unsupported browsers (Firefox, older Safari) report supported === false so
// the consumer can hide the mic affordance.
//
// If a provider-consistent / cross-browser path is ever needed, swap this hook
// for a MediaRecorder -> POST /api/transcribe (Groq whisper-large-v3) flow; the
// { supported, listening, transcript, interim, error, start, stop, reset }
// contract is what PromptComposer depends on, not the recognizer itself.

// Minimal, uniquely-named local typings so we don't depend on (or collide
// with) whatever the installed TS DOM lib does or doesn't declare for the
// still-non-standard Web Speech API.
interface SRAlternative {
  readonly transcript: string
}
interface SRResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SRAlternative
}
interface SRResultList {
  readonly length: number
  readonly [index: number]: SRResult
}
interface SREvent {
  readonly resultIndex: number
  readonly results: SRResultList
}
interface SRErrorEvent {
  readonly error?: string
}
interface SRInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
}
type SRConstructor = new () => SRInstance

function getRecognitionCtor(): SRConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor
    webkitSpeechRecognition?: SRConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UseSpeechRecognition {
  /** Whether this browser exposes the Web Speech API at all. */
  supported: boolean
  /** True while the recognizer is actively listening. */
  listening: boolean
  /** Finalized transcript accumulated during the current session. */
  transcript: string
  /** In-progress (not yet finalized) words for the current utterance. */
  interim: string
  /** Last recognizer error code (e.g. 'not-allowed', 'no-speech'), or null. */
  error: string | null
  /** Begin a fresh listening session. Call reset() first for a clean slate. */
  start: () => void
  /** Stop listening; any pending final result is flushed into transcript. */
  stop: () => void
  /** Clear transcript/interim/error for a new session. */
  reset: () => void
}

export function useSpeechRecognition(opts?: {
  lang?: string
}): UseSpeechRecognition {
  const lang = opts?.lang ?? 'en-US'
  const ctorRef = useRef<SRConstructor | null>(null)
  if (ctorRef.current === null) ctorRef.current = getRecognitionCtor()
  const supported = ctorRef.current !== null

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<SRInstance | null>(null)
  const finalRef = useRef('')

  const reset = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = ctorRef.current
    if (!Ctor) {
      setError('unsupported')
      return
    }
    // Guard against a double-start (SpeechRecognition throws on it).
    if (recRef.current) return

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalRef.current += text
        else pending += text
      }
      setTranscript(finalRef.current)
      setInterim(pending)
    }
    rec.onerror = (e) => {
      setError(e.error ?? 'error')
    }
    rec.onend = () => {
      recRef.current = null
      setInterim('')
      setListening(false)
    }

    recRef.current = rec
    setError(null)
    setInterim('')
    try {
      rec.start()
      setListening(true)
    } catch {
      // start() can throw if the recognizer is mid-teardown; drop the handle
      // so the next start() builds a fresh instance.
      recRef.current = null
    }
  }, [lang])

  // Abort any in-flight recognition on unmount.
  useEffect(
    () => () => {
      recRef.current?.abort()
      recRef.current = null
    },
    [],
  )

  return {
    supported,
    listening,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
  }
}
