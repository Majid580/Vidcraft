import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Theme } from '@/hooks/useTheme'

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme
  onToggle: () => void
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="hover-glow relative size-9 overflow-hidden rounded-full"
    >
      <Sun
        className="size-4 transition-all duration-500 dark:-rotate-90 dark:scale-0"
        style={{ position: 'absolute' }}
      />
      <Moon
        className="size-4 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100"
        style={{ position: 'absolute' }}
      />
    </Button>
  )
}
