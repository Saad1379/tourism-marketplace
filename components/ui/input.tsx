import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, disabled, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      disabled={disabled}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm transition-[color,box-shadow]',
        'border-input placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-foreground file:text-sm file:font-medium',
        'selection:bg-primary selection:text-primary-foreground',
        'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'dark:bg-input/30 dark:border-input/50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
