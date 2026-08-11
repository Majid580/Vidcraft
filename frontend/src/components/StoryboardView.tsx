import {
  Camera,
  Clapperboard,
  Clock,
  Film,
  ImageIcon,
  Palette,
  Sparkles,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Shot, StoryboardResponse } from '@/lib/types'

// ADR-020: shots carry the user's explicitly-chosen provider by name (no
// agent decision), so the badge shows exactly which one rendered this shot.
const PROVIDER_BADGE: Record<
  Shot['provider'],
  { label: string; icon: typeof Film; variant: 'violet' | 'cyan' | 'warning' }
> = {
  remotion: { label: 'Remotion', icon: Film, variant: 'violet' },
  pollinations: { label: 'Pollinations', icon: ImageIcon, variant: 'cyan' },
  cloudflare: { label: 'Cloudflare', icon: Sparkles, variant: 'cyan' },
  huggingface: { label: 'Hugging Face', icon: Camera, variant: 'warning' },
}

function PathwayBadge({ provider }: { provider: Shot['provider'] }) {
  const { label, icon: Icon, variant } = PROVIDER_BADGE[provider]
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0)
    return <span className="text-muted-foreground text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="surface-1 rounded-full border border-border px-2.5 py-0.5 text-xs"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

export function StoryboardView({ data }: { data: StoryboardResponse }) {
  const { worldState, shots } = data
  const totalDuration = shots.reduce((s, sh) => s + (sh.duration_s || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      {/* World state */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Clapperboard className="size-4 text-primary" />
              World state
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{shots.length} shots</Badge>
              <Badge variant="outline">
                <Clock className="size-3" />
                {totalDuration}s
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Camera className="size-3.5" /> Setting
              </div>
              <p className="text-sm">{worldState.setting}</p>
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Users className="size-3.5" /> Characters
              </div>
              <Chips items={worldState.characters} />
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Palette className="size-3.5" /> Style
              </div>
              <Chips items={worldState.style_tokens} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shot list */}
      <div className="grid gap-4">
        {shots.map((shot) => (
          <Card
            key={shot.shot_id}
            className="glow-border hover-lift"
          >
            <CardContent className="flex gap-4">
              <div className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">
                {shot.shot_id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Shot {shot.shot_id}
                  </span>
                  <PathwayBadge provider={shot.provider} />
                  <Badge variant="outline">
                    <Clock className="size-3" />
                    {shot.duration_s}s
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed">{shot.description}</p>
                <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                  <Camera className="size-3.5" />
                  <span className="font-mono">{shot.camera}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
