import { useCallback, useRef } from 'react'

// Lightweight 3D tilt-on-hover. Sets --tilt-x / --tilt-y CSS vars consumed
// by the .tilt-3d utility. Pointer-driven, no dependency; disabled when the
// user prefers reduced motion.
export function useTilt(max = 6) {
  const ref = useRef<HTMLDivElement>(null)

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el || reduce) return
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--tilt-y', `${px * max * 2}deg`)
      el.style.setProperty('--tilt-x', `${-py * max * 2}deg`)
    },
    [max, reduce],
  )

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
  }, [])

  return { ref, onPointerMove: onMove, onPointerLeave: onLeave }
}
