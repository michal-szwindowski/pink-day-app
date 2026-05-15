import { Camera, CircleAlert } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { TodayTaskItem } from '@/lib/data'
import { formatPoints } from '@/lib/points'

type TaskCardProps = {
  task: TodayTaskItem
  onSubmit: (task: TodayTaskItem) => void
}

export function TaskCard({ task, onSubmit }: TaskCardProps) {
  const canSubmit = !task.latestSubmission || task.latestSubmission.status === 'rejected'

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#422c36]">{task.title}</h3>
          {task.description ? (
            <p className="mt-1 text-sm text-[#7e6870]">{task.description}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-bold text-[#d3487c]">
          {formatPoints(task.points)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[#fff7fa] px-3 py-1 text-xs text-[#7f6870]">
          {task.type === 'daily' ? 'Codziennie' : 'Jednorazowe'}
        </span>
        {task.requires_photo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f4] px-3 py-1 text-xs text-[#b54272]">
            <Camera size={14} />
            Wymaga zdjęcia
          </span>
        ) : null}
      </div>

      {task.latestSubmission ? (
        <div className="space-y-2 rounded-3xl bg-[#fff8fb] p-3">
          <StatusBadge status={task.latestSubmission.status} />
          {task.latestSubmission.rejection_reason ? (
            <p className="inline-flex items-start gap-2 text-sm text-[#9b4f63]">
              <CircleAlert className="mt-0.5 shrink-0" size={16} />
              {task.latestSubmission.rejection_reason}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-3xl bg-[#fff8fb] p-3 text-sm text-[#7f6870]">Do zrobienia</div>
      )}

      <Button
        disabled={!canSubmit}
        fullWidth
        onClick={() => onSubmit(task)}
        variant={canSubmit ? 'primary' : 'secondary'}
      >
        {task.latestSubmission?.status === 'rejected'
          ? 'Wyślij ponownie'
          : canSubmit
            ? 'Wyślij wykonanie'
            : 'Już wysłane'}
      </Button>
    </Card>
  )
}
