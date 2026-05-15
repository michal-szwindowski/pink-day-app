import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

let browserClient: SupabaseClient<Database> | null = null
const FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjAsImV4cCI6MjAwMDAwMDAwMH0.placeholder'

function readPublicEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Brakuje zmiennej środowiskowej ${name}.`)
  }

  return value
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const isBrowser = typeof window !== 'undefined'
    const supabaseUrl = isBrowser
      ? readPublicEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
      : process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
    const supabaseAnonKey = isBrowser
      ? readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: isBrowser,
        detectSessionInUrl: isBrowser,
        flowType: 'pkce',
      },
    })
  }

  return browserClient
}
