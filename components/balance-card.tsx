import { Sparkles } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatPoints } from '@/lib/points'

export function BalanceCard({ balance }: { balance: number }) {
  return (
    <Card className="bg-[linear-gradient(135deg,#fff9fc,#ffe4ef)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#8a6b77]">Twoje punkty</p>
          <p className="mt-1 text-3xl font-black text-[#432b36]">{formatPoints(balance)}</p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-[#ff6e9d]">
          <Sparkles size={22} />
        </div>
      </div>
    </Card>
  )
}
