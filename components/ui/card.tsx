import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_40px_-28px_rgba(122,65,88,0.5)] backdrop-blur lg:p-6',
        className,
      )}
      {...props}
    />
  )
}
