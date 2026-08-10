import { Clapperboard, FlaskConical, Sparkles } from 'lucide-react'

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
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="brand-gradient brand-shadow animate-float grid size-9 place-items-center rounded-xl">
            <Clapperboard className="size-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="leading-none">
            <div className="text-lg font-semibold tracking-tight">
              Vid<span className="gradient-text-anim">Craft</span>
            </div>
            <div className="text-muted-foreground text-[11px]">
              Prompt-driven video generation
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {demoMode && (
            <Badge variant="warning" className="hidden sm:inline-flex">
              <FlaskConical className="size-3" />
              Demo mode
            </Badge>
          )}
          <Badge variant="violet" className="hidden md:inline-flex">
            <Sparkles className="size-3" />
            Multi-agent pipeline
          </Badge>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}
