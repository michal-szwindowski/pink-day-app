'use client'

import { Bell, BellOff } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { useAppContext } from '@/components/providers/app-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { urlBase64ToUint8Array } from '@/lib/push'
import type { Json } from '@/lib/supabase/types'

type PushSupportState = 'checking' | 'unsupported' | 'supported'

export function PushSettings() {
  const { profile, supabase } = useAppContext()
  const [support, setSupport] = useState<PushSupportState>('checking')
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setSupport('unsupported')
      return
    }

    setSupport('supported')
    setPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => setIsSubscribed(false))
  }, [])

  const enablePush = () => {
    if (!profile) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!publicKey) {
          throw new Error('Brakuje NEXT_PUBLIC_VAPID_PUBLIC_KEY w env.')
        }

        const nextPermission = await Notification.requestPermission()
        setPermission(nextPermission)

        if (nextPermission !== 'granted') {
          throw new Error('Nie udzielono zgody na powiadomienia.')
        }

        const registration = await navigator.serviceWorker.ready
        const existingSubscription = await registration.pushManager.getSubscription()
        const subscription =
          existingSubscription ??
          (await registration.pushManager.subscribe({
            applicationServerKey: urlBase64ToUint8Array(publicKey),
            userVisibleOnly: true,
          }))

        const upsertResponse = await supabase.from('push_subscriptions').upsert(
          {
            endpoint: subscription.endpoint,
            profile_id: profile.id,
            subscription: subscription.toJSON() as unknown as Json,
            user_agent: navigator.userAgent,
          },
          { onConflict: 'endpoint' },
        )

        if (upsertResponse.error) {
          throw upsertResponse.error
        }

        setIsSubscribed(true)
        setMessage('Powiadomienia są włączone na tym urządzeniu.')
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Nie udało się włączyć push.')
      }
    })
  }

  const disablePush = () => {
    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)

        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
          await subscription.unsubscribe()
        }

        setIsSubscribed(false)
        setMessage('Powiadomienia są wyłączone na tym urządzeniu.')
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : 'Nie udało się wyłączyć push.',
        )
      }
    })
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[#fff0f6] p-3 text-[#d34d7d]">
          {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#422c36]">Powiadomienia push</h2>
          <p className="text-sm leading-6 text-[#7f6870]">
            Dostaniesz powiadomienie, gdy druga osoba wyśle zgłoszenie, odbierze nagrodę albo gdy
            Twoje zgłoszenie zostanie ocenione.
          </p>
        </div>
      </div>

      {support === 'unsupported' ? (
        <p className="rounded-3xl bg-[#fff1f4] p-4 text-sm text-[#a2435f]">
          Ta przeglądarka nie obsługuje Web Push. Na iPhonie dodaj aplikację do ekranu początkowego
          i otwórz ją jako ikonę aplikacji.
        </p>
      ) : null}

      {permission === 'denied' ? (
        <p className="rounded-3xl bg-[#fff1f4] p-4 text-sm text-[#a2435f]">
          Powiadomienia są zablokowane w ustawieniach systemu/przeglądarki.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-3xl bg-[#eefaf3] p-4 text-sm text-[#2f7753]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-3xl bg-[#fff1f4] p-4 text-sm text-[#a2435f]">{error}</p>
      ) : null}

      {isSubscribed ? (
        <Button disabled={isPending} fullWidth onClick={disablePush} variant="secondary">
          Wyłącz powiadomienia na tym urządzeniu
        </Button>
      ) : (
        <Button
          disabled={isPending || support !== 'supported' || permission === 'denied'}
          fullWidth
          onClick={enablePush}
        >
          Włącz powiadomienia na tym urządzeniu
        </Button>
      )}
    </Card>
  )
}
