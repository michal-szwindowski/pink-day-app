import type { SubmissionStatus } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const labelByStatus: Record<SubmissionStatus, string> = {
  pending: 'Oczekuje na akceptację',
  approved: 'Zaakceptowane',
  rejected: 'Odrzucone',
}

const classByStatus: Record<SubmissionStatus, string> = {
  pending: 'bg-[#fff3d8] text-[#91651a]',
  approved: 'bg-[#dff6ea] text-[#2f7a58]',
  rejected: 'bg-[#ffe0e4] text-[#a13b56]',
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        classByStatus[status],
      )}
    >
      {labelByStatus[status]}
    </span>
  )
}
