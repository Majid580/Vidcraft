import { ArrowRight, Camera, ImageIcon, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { SingleImageResponse } from '@/lib/types'

const PROVIDER_LABEL: Record<SingleImageResponse['provider'], string> = {
  pollinations: 'Pollinations',
  cloudflare: 'Cloudflare',
}

// Single-image mode's result: no shots, no storyboard — just the
// before/after prompt (so the enhancement is visibly legible) and the one
// generated image.
export function SingleImageView({ data }: { data: SingleImageResponse }) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <ImageIcon className="size-4 text-primary" />
              Single image
            </h3>
            <Badge variant="cyan">
              <Camera className="size-3" />
              {PROVIDER_LABEL[data.provider]}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs">Your prompt</div>
              <p className="text-sm leading-relaxed">{data.originalPrompt}</p>
            </div>
            <ArrowRight className="text-muted-foreground mt-1 hidden size-4 shrink-0 sm:block" />
            <div className="space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                Enhanced prompt
              </div>
              <p className="text-foreground/90 text-sm italic leading-relaxed">
                “{data.enhancedPrompt}”
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glow-border overflow-hidden p-0">
        <img
          src={data.imageUrl}
          alt={data.enhancedPrompt}
          className="aspect-square w-full object-cover"
        />
      </Card>
    </div>
  )
}
