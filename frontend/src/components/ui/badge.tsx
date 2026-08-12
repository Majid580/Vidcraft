import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  // Badges read as slate fields: monospaced, uppercase, tracked, square-ish.
  // A clapperboard does not have pill-shaped rounded tags on it.
  'inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.12em] whitespace-nowrap uppercase transition-colors [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/12 text-primary',
        outline: 'border-border text-muted-foreground',
        amber: 'border-primary/30 bg-primary/12 text-primary',
        cyan: 'border-accent/30 bg-accent/12 text-accent',
        success: 'border-success/30 bg-success/12 text-success',
        warning: 'border-warning/30 bg-warning/12 text-warning',
        destructive:
          'border-destructive/30 bg-destructive/12 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
