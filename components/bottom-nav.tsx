'use client'

import { ClipboardList, Gift, HeartHandshake, History, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  const items = memberItems

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div
        className="grid w-full max-w-md rounded-t-[30px] border border-white/80 border-b-0 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-18px_34px_-28px_rgba(76,35,51,0.42)] backdrop-blur"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold transition',
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
