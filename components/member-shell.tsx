import type { PropsWithChildren } from 'react'

import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

export function MemberShell({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('member-shell', className)}>
      <BottomNav />
      <div className="member-content">
        <div className="member-stage">{children}</div>
      </div>
    </div>
  )
}
