'use client'

import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'

import { type AppSupabaseClient, resolveProfileForSession } from '@/lib/data'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ProfileRole, Tables } from '@/lib/supabase/types'

type AppStatus = 'loading' | 'signed_out' | 'no_access' | 'error' | 'ready'

type AppContextValue = {
  authUserId: string | null
  authUserEmail: string | null
  profile: Tables<'profiles'> | null
  role: ProfileRole | null
  status: AppStatus
  supabase: AppSupabaseClient
  lastError: string | null
  refreshProfile: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function getErrorMessage(caughtError: unknown) {
  if (caughtError instanceof Error) {
    return caughtError.message
  }

  if (
    caughtError &&
    typeof caughtError === 'object' &&
    'message' in caughtError &&
    typeof caughtError.message === 'string'
  ) {
    return caughtError.message
  }

  try {
    return JSON.stringify(caughtError)
  } catch {
    return 'Nieznany błąd logowania.'
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const supabase = getSupabaseBrowserClient()
  const [status, setStatus] = useState<AppStatus>('loading')
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const boot = useEffectEvent(async () => {
    try {
      setStatus('loading')
      setLastError(null)

      const sessionResponse = await supabase.auth.getSession()
      if (sessionResponse.error) {
        throw sessionResponse.error
      }

      const authUser = sessionResponse.data.session?.user ?? null

      if (!authUser) {
        setAuthUserId(null)
        setAuthUserEmail(null)
        setProfile(null)
        setStatus('signed_out')
        return
      }

      setAuthUserId(authUser.id)
      setAuthUserEmail(authUser.email?.toLowerCase() ?? null)

      const resolvedProfile = await resolveProfileForSession(supabase, authUser.id)

      if (!resolvedProfile) {
        setProfile(null)
        setStatus('no_access')
        return
      }

      setProfile(resolvedProfile)
      setStatus('ready')
    } catch (caughtError) {
      setLastError(getErrorMessage(caughtError))
      setProfile(null)
      setStatus('error')
    }
  })

  useEffect(() => {
    void boot()
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void boot()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const value: AppContextValue = {
    authUserId,
    authUserEmail,
    profile,
    role: profile?.role ?? null,
    status,
    supabase,
    lastError,
    refreshProfile: async () => {
      await boot()
    },
    signInWithGoogle: async () => {
      const redirectTo = `${window.location.origin}/auth/callback`
      const response = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (response.error) {
        throw response.error
      }
    },
    signOut: async () => {
      await supabase.auth.signOut()
      setAuthUserId(null)
      setAuthUserEmail(null)
      setProfile(null)
      setStatus('signed_out')
    },
  }

  return <AppContext value={value}>{children}</AppContext>
}

export function useAppContext() {
  const context = use(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider.')
  }

  return context
}
