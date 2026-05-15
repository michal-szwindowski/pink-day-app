import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

function readServerEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Brakuje zmiennej środowiskowej ${name}.`)
  }

  return value
}

export function getSupabaseServiceClient() {
  return createClient<Database>(
    readServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export function getSupabaseAuthClient(accessToken: string) {
  return createClient<Database>(
    readServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  )
}
