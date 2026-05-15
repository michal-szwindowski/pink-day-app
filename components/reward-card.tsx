import { Gift } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { canAffordReward, formatPoints } from '@/lib/points'
import type { Tables } from '@/lib/supabase/types'

type RewardCardProps = {
  balance: number
  reward: Tables<'rewards'>
  onRedeem: (reward: Tables<'rewards'>) => void
}

export function RewardCard({ balance, reward, onRedeem }: RewardCardProps) {
  const isAvailable = canAffordReward(balance, reward.cost)

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#422c36]">{reward.title}</h3>
          {reward.description ? (
            <p className="mt-1 text-sm text-[#7e6870]">{reward.description}</p>
          ) : null}
        </div>
        <div className="rounded-full bg-[#fff0f6] p-3 text-[#d3487c]">
          <Gift size={18} />
        </div>
      </div>

      <div className="rounded-3xl bg-[#fff8fb] px-4 py-3 text-sm font-semibold text-[#6f5862]">
        Koszt: {formatPoints(reward.cost)}
      </div>

      <Button
        fullWidth
        onClick={() => onRedeem(reward)}
        variant={isAvailable ? 'primary' : 'secondary'}
      >
        {isAvailable ? 'Odbierz' : 'Za mało punktów'}
      </Button>
    </Card>
  )
}
