import type { AppSupabaseClient } from '@/lib/data'

export type PushPayload = {
  body: string
  recipientProfileIds: string[]
  title: string
  url?: string
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function sendPushNotification(supabase: AppSupabaseClient, payload: PushPayload) {
  const sessionResponse = await supabase.auth.getSession()
  const token = sessionResponse.data.session?.access_token

  if (!token) {
    return
  }

  await fetch('/api/push/send', {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  }).catch(() => {
    // Push is a nice-to-have; app actions should not fail because notification delivery failed.
  })
}
