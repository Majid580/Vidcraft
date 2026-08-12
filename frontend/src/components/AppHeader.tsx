import { Aperture, FlaskConical } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { Theme } from '@/hooks/useTheme'

export function AppHeader({
  theme,
  onToggleTheme,
  demoMode,
}: {
  theme: Theme
  onToggleTheme: () => void
  demoMode: boolean
}) {
  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {/* An aperture, not a clapperboard: this tool decides how a scene is
              exposed and framed, which is the lens's job, not the slate's. */}
          <div className="border-border bg-card text-primary grid size-9 shrink-0 place-items-center rounded-[5px] border">
            <Aperture className="size-[18px]" strokeWidth={1.75} />
          </div>
          <div className="leading-none">
            <div className="font-display text-[19px] leading-none font-semibold tracking-tight">
              VidCraft
            </div>
            {/* The grade axis appears as a hairline under the wordmark — the
                only place the gradient is used at this size. */}
            <div className="grade-fill mt-1 h-px w-full opacity-70" />
            <div className="slate-label mt-1.5">Prompt → storyboard → film</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {demoMode && (
            <Badge variant="warning" className="hidden sm:inline-flex">
              <FlaskConical className="size-3" />
              Demo
            </Badge>
          )}
          <Badge variant="outline" className="hidden md:inline-flex">
            4 agents
          </Badge>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}
