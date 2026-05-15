'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LoadingScreen } from '@/components/loading-screen'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [label, setLabel] = useState('Kończę logowanie...')

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      router.replace('/auth')
      return
    }

    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          throw error
        }

        router.replace('/')
      })
      .catch(() => {
        setLabel('Nie udało się dokończyć logowania. Wracam do ekranu wejścia...')
        window.setTimeout(() => {
          router.replace('/auth')
        }, 1200)
      })
  }, [router])

  return <LoadingScreen label={label} />
}
