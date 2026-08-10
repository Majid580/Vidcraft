import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Scroll-driven 3D reveal. Adds `.is-visible` when the element enters the
// viewport, triggering the perspective/rotateX transition in index.css.
//
// Uses manual viewport checks (rAF on mount + passive scroll/resize) rather
// than IntersectionObserver so content is never left stuck at opacity:0 in
// environments where IO callbacks don't fire reliably.
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setVisible(true)
      window.removeEventListener('scroll', check, true)
      window.removeEventListener('resize', check)
    }
    const check = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || document.documentElement.clientHeight
      // Trigger a little before the element is fully on screen.
      if (r.top < vh * 0.92 && r.bottom > 0) reveal()
    }

    const raf = requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true, capture: true })
    window.addEventListener('resize', check)
    // Safety net: never leave content hidden.
    const fallback = window.setTimeout(reveal, 1200)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(fallback)
      window.removeEventListener('scroll', check, true)
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn('reveal-3d', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
