import type { ProfileRole } from '@/lib/supabase/types'

export function getHomePathForRole(role: ProfileRole) {
  return role === 'owner' || role === 'member' ? '/' : '/'
}

export function getDisplayNameFallback(email: string | null | undefined, role: ProfileRole) {
  if (role === 'owner') {
    return 'Michał'
  }

  if (!email) {
    return 'Lena'
  }

  const localPart = email.split('@')[0]?.trim()
  if (!localPart) {
    return 'Lena'
  }

  return localPart.charAt(0).toUpperCase() + localPart.slice(1)
}
