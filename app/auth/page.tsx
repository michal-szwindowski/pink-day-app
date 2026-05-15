'use client'

import { HeartHandshake, LogIn, LogOut, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { LoadingScreen } from '@/components/loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getHomePathForRole } from '@/lib/device'

export default function AuthPage() {
  const router = useRouter()
  const {
    authUserEmail,
    lastError,
    refreshProfile,
    role,
    signInWithGoogle,
    signOut,
    status,
    supabase,
  } = useAppContext()
  const [error, setError] = useState<string | null>(null)
  const [isCompletingLogin, setIsCompletingLogin] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      return
    }

    setIsCompletingLogin(true)

    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          throw exchangeError
        }

        window.history.replaceState({}, '', '/auth')
        return refreshProfile()
      })
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Nie udało się dokończyć logowania Google.',
        )
      })
      .finally(() => {
        setIsCompletingLogin(false)
      })
  }, [refreshProfile, supabase])

  useEffect(() => {
    if (status === 'ready' && role) {
      router.replace(getHomePathForRole(role))
    }
  }, [role, router, status])

  if (status === 'loading' || isCompletingLogin) {
    return <LoadingScreen label="Kończę logowanie..." />
  }

  return (
    <main className="app-shell px-4 py-8">
      <Card className="mt-6 overflow-hidden bg-[linear-gradient(180deg,#fffdfd,#fff3f8)]">
        <div className="space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ffe4ef] text-[#d54d80]">
            <HeartHandshake size={30} />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black text-[#422c36]">Pink Day</h1>
            <p className="mt-2 text-sm leading-6 text-[#7f6870]">
              Prywatna, prosta aplikacja tylko dla Was. Zaloguj się swoim kontem Google, żeby wejść
              do odpowiedniego widoku.
            </p>
          </div>

          {status === 'no_access' ? (
            <div className="space-y-4 rounded-[28px] bg-white/85 p-4">
              <div className="flex items-start gap-3 rounded-3xl bg-[#fff4f6] p-4 text-sm text-[#994761]">
                <ShieldAlert className="mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="font-semibold text-[#7f334e]">To konto nie ma jeszcze dostępu.</p>
                  <p className="mt-1">
                    {authUserEmail
                      ? `Zalogowano jako ${authUserEmail}. Owner albo admin musi dodać ten adres w dashboardzie.`
                      : 'Owner albo admin musi najpierw dodać ten adres w dashboardzie.'}
                  </p>
                </div>
              </div>

              <Button
                disabled={isSigningOut}
                fullWidth
                onClick={() => {
                  setIsSigningOut(true)
                  void signOut().finally(() => setIsSigningOut(false))
                }}
                variant="secondary"
              >
                <LogOut className="mr-2" size={18} />
                {isSigningOut ? 'Wylogowywanie...' : 'Wyloguj i zmień konto'}
              </Button>
            </div>
          ) : status === 'error' ? (
            <div className="space-y-4 rounded-[28px] bg-white/85 p-4">
              <div className="flex items-start gap-3 rounded-3xl bg-[#fff4f6] p-4 text-sm text-[#994761]">
                <ShieldAlert className="mt-0.5 shrink-0" size={18} />
                <div>
                  <p className="font-semibold text-[#7f334e]">Logowanie działa, ale profil nie.</p>
                  <p className="mt-1">
                    {lastError ??
                      'Najczęściej oznacza to, że migracja SQL nie przeszła do końca albo brakuje funkcji sync_current_profile.'}
                  </p>
                </div>
              </div>

              <Button
                disabled={isSigningOut}
                fullWidth
                onClick={() => {
                  setIsSigningOut(true)
                  void signOut().finally(() => setIsSigningOut(false))
                }}
                variant="secondary"
              >
                <LogOut className="mr-2" size={18} />
                {isSigningOut ? 'Wylogowywanie...' : 'Wyloguj i spróbuj ponownie'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-[28px] bg-white/85 p-4">
              <p className="text-sm leading-6 text-[#7f6870]">
                Konto ownera zarządza aplikacją główną, admin pomaga zarządzać dostępem, a każdy
                dopuszczony użytkownik korzysta z aplikacji jako member.
              </p>

              {error ? (
                <p className="rounded-2xl bg-[#ffe7ee] px-4 py-3 text-sm text-[#ab4661]">{error}</p>
              ) : null}

              <Button
                disabled={isPending}
                fullWidth
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setError(null)
                      await signInWithGoogle()
                    } catch (caughtError) {
                      setError(
                        caughtError instanceof Error
                          ? caughtError.message
                          : 'Nie udało się rozpocząć logowania Google.',
                      )
                    }
                  })
                }}
              >
                <LogIn className="mr-2" size={18} />
                {isPending ? 'Przechodzę do Google...' : 'Zaloguj przez Google'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </main>
  )
}
