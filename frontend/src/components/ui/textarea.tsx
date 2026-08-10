import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex w-full rounded-xl border border-input bg-input/40 px-4 py-3 text-base shadow-sm transition-colors outline-none',
        'placeholder:text-muted-foreground/70 resize-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
