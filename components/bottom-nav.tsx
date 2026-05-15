'use client'

import { ClipboardList, Gift, HeartHandshake, History, Sparkles, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAppContext } from '@/components/providers/app-provider'
import { cn } from '@/lib/utils'

type BottomNavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

const memberItems: BottomNavItem[] = [
  { href: '/', label: 'Dzisiaj', icon: <ClipboardList size={18} /> },
  { href: '/pair', label: 'Para', icon: <HeartHandshake size={18} /> },
  { href: '/rewards', label: 'Nagrody', icon: <Gift size={18} /> },
  { href: '/history', label: 'Historia', icon: <History size={18} /> },
  { href: '/account', label: 'Konto', icon: <UserRound size={18} /> },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAppContext()
  const items = memberItems

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center lg:sticky lg:top-8 lg:inset-auto lg:block lg:self-start">
      <div
        className="grid w-full max-w-md rounded-t-[30px] border border-white/80 border-b-0 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-18px_34px_-28px_rgba(76,35,51,0.42)] backdrop-blur lg:flex lg:max-w-none lg:flex-col lg:gap-3 lg:rounded-[34px] lg:border-b lg:p-4 lg:shadow-[0_28px_70px_-34px_rgba(76,35,51,0.48)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <div className="hidden rounded-[28px] bg-[linear-gradient(135deg,#fff7fb,#ffe7ef)] p-4 lg:block">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/85 p-3 text-[#d34d7d]">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
                Pink Day
              </p>
              <p className="mt-1 text-sm font-semibold text-[#422c36]">
                {profile?.display_name ?? 'Twoje miejsce'}
              </p>
            </div>
          </div>
        </div>

        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3 lg:text-sm',
                isActive ? 'bg-[#ffe3ed] text-[#ba396b]' : 'text-[#826a73] hover:bg-[#fff5f8]',
              )}
              href={item.href}
              key={item.href}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
