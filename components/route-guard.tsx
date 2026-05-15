'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { LoadingScreen } from '@/components/loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { getHomePathForRole } from '@/lib/device'
import type { ProfileRole } from '@/lib/supabase/types'

type RouteGuardProps = {
  allow: ProfileRole[]
  children: React.ReactNode
}

export function RouteGuard({ allow, children }: RouteGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { role, status } = useAppContext()

  useEffect(() => {
    if (
      (status === 'signed_out' || status === 'no_access' || status === 'error') &&
      pathname !== '/auth'
    ) {
      router.replace('/auth')
      return
    }

    if (status === 'ready' && role && !allow.includes(role)) {
      router.replace(getHomePathForRole(role))
    }
  }, [allow, pathname, role, router, status])

  if (status !== 'ready') {
    return <LoadingScreen />
  }

  if (!role || !allow.includes(role)) {
    return <LoadingScreen label="Przekierowanie..." />
  }

  return <>{children}</>
}
