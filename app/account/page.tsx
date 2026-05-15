'use client'

import { Copy, LogOut, ShieldCheck, Unlink, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'

import { BottomNav } from '@/components/bottom-nav'
import { LoadingScreen } from '@/components/loading-screen'
import { MemberLoadingScreen } from '@/components/member-loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { useToast } from '@/components/providers/toast-provider'
import { PushSettings } from '@/components/push-settings'
import { PwaInstallHelp } from '@/components/pwa-install-help'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModalOverlay } from '@/components/ui/modal'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import { useBodyScrollLock } from '@/components/use-body-scroll-lock'
import { fetchMyPairs } from '@/lib/data'
import { getErrorMessage } from '@/lib/errors'

function getPartnerName(pair: Awaited<ReturnType<typeof fetchMyPairs>>[number], profileId: string) {
  const partner = pair.pair_members.find((member) => member.profile_id !== profileId)?.profiles
  return partner?.display_name ?? partner?.email ?? 'partnerem/partnerką'
}

function getMyMembership(
  pair: Awaited<ReturnType<typeof fetchMyPairs>>[number],
  profileId: string,
) {
  return pair.pair_members.find((member) => member.profile_id === profileId) ?? null
}

function getPartnerLabel(
  pair: Awaited<ReturnType<typeof fetchMyPairs>>[number],
  profileId: string,
) {
  const myMembership = getMyMembership(pair, profileId)

  return myMembership?.partner_nickname?.trim() || getPartnerName(pair, profileId)
}

export default function AccountPage() {
  const router = useRouter()
  const { authUserEmail, profile, refreshProfile, signOut, status, supabase } = useAppContext()
  const { showToast } = useToast()
  const [pairs, setPairs] = useState<Awaited<ReturnType<typeof fetchMyPairs>>>([])
  const [displayName, setDisplayName] = useState('')
  const [partnerNicknames, setPartnerNicknames] = useState<Record<string, string>>({})
  const [savedPartnerNicknames, setSavedPartnerNicknames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pairToLeave, setPairToLeave] = useState<
    Awaited<ReturnType<typeof fetchMyPairs>>[number] | null
  >(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useBodyScrollLock(Boolean(pairToLeave) || showSignOutConfirm)

  const leavePair = (pair: Awaited<ReturnType<typeof fetchMyPairs>>[number]) => {
    if (!profile) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)
        setPairToLeave(null)

        const response = await supabase.rpc('leave_pair', {
          p_pair_id: pair.id,
          p_profile_id: profile.id,
        })

        if (response.error) {
          throw response.error
        }

        setMessage('Odłączono Cię od pary.')
        showToast('Odłączono Cię od pary.', 'success')
        await loadData(false)
      } catch (caughtError) {
        const nextError = getErrorMessage(caughtError, 'Nie udało się odłączyć od pary.')
        setError(nextError)
        showToast(nextError, 'error')
      }
    })
  }

  const loadData = useEffectEvent(async (showLoader = false) => {
    if (!profile) {
      return
    }

    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const nextPairs = await fetchMyPairs(supabase, profile.id)
      const nextSavedPartnerNicknames = Object.fromEntries(
        nextPairs.map((pair) => [
          pair.id,
          getMyMembership(pair, profile.id)?.partner_nickname ?? '',
        ]),
      )
      setPairs(nextPairs)
      setSavedPartnerNicknames(nextSavedPartnerNicknames)
      setPartnerNicknames((current) =>
        Object.fromEntries(
          nextPairs.map((pair) => [
            pair.id,
            (current[pair.id] ?? savedPartnerNicknames[pair.id] ?? '') ===
            (savedPartnerNicknames[pair.id] ?? '')
              ? (nextSavedPartnerNicknames[pair.id] ?? '')
              : (current[pair.id] ?? ''),
          ]),
        ),
      )
      setDisplayName(profile.display_name ?? '')
      setError(null)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Nie udało się wczytać konta.'))
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    if (status === 'signed_out' || status === 'no_access' || status === 'error') {
      router.replace('/auth')
      return
    }

    if (status === 'ready') {
      void loadData(true)
    }
  }, [router, status])

  useAutoRefresh(async () => {
    await loadData(false)
  })

  const savePartnerNickname = (pair: Awaited<ReturnType<typeof fetchMyPairs>>[number]) => {
    if (!profile) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)

        const response = await supabase.rpc('update_partner_nickname', {
          p_pair_id: pair.id,
          p_partner_nickname: partnerNicknames[pair.id] ?? '',
          p_profile_id: profile.id,
        })

        if (response.error) {
          throw response.error
        }

        setSavedPartnerNicknames((current) => ({
          ...current,
          [pair.id]: partnerNicknames[pair.id] ?? '',
        }))
        setMessage('Pseudonim został zapisany.')
        showToast('Pseudonim został zapisany.', 'success')
        await loadData(false)
      } catch (caughtError) {
        const nextError = getErrorMessage(caughtError, 'Nie udało się zapisać pseudonimu.')
        setError(nextError)
        showToast(nextError, 'error')
      }
    })
  }

  if (isLoading) {
    return status === 'ready' ? (
      <MemberLoadingScreen label="Ładowanie konta..." />
    ) : (
      <LoadingScreen label="Ładowanie konta..." />
    )
  }

  return (
    <div className="app-shell px-4 pb-32 pt-5">
      <main className="section-stack">
        <section className="space-y-2 px-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">Konto</p>
          <h1 className="text-3xl font-black text-[#422c36]">Twoje ustawienia</h1>
          <p className="text-sm leading-6 text-[#7f6870]">
            Tutaj zmienisz swoją nazwę, sprawdzisz rolę i możesz odłączyć się od pary.
          </p>
        </section>

        {message ? <Card className="bg-[#eefaf3] text-sm text-[#2f7753]">{message}</Card> : null}
        {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

        <PwaInstallHelp />
        <PushSettings />

        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[#fff0f6] p-3 text-[#d34d7d]">
              <UserRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#422c36]">Profil</h2>
              <p className="text-sm text-[#7f6870]">{authUserEmail}</p>
            </div>
          </div>

          <label>
            <span className="field-label">Nazwa widoczna w aplikacji</span>
            <input
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Twoja nazwa"
              value={displayName}
            />
          </label>

          <Button
            disabled={isPending}
            fullWidth
            onClick={() => {
              if (!profile) {
                return
              }

              startTransition(async () => {
                try {
                  setError(null)
                  setMessage(null)

                  const response = await supabase.rpc('update_profile_display_name', {
                    p_display_name: displayName,
                    p_profile_id: profile.id,
                  })

                  if (response.error) {
                    throw response.error
                  }

                  await refreshProfile()
                  setMessage('Nazwa została zapisana.')
                  showToast('Nazwa została zapisana.', 'success')
                } catch (caughtError) {
                  const nextError = getErrorMessage(caughtError, 'Nie udało się zapisać nazwy.')
                  setError(nextError)
                  showToast(nextError, 'error')
                }
              })
            }}
          >
            Zapisz nazwę
          </Button>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-[#422c36]">Twój kod zaproszenia</h2>
          <p className="text-sm leading-6 text-[#7f6870]">
            Ten kod służy do połączenia się z drugą osobą. Nie jest kodem pokoju.
          </p>
          <div className="rounded-3xl bg-[#fff8fb] px-5 py-4">
            <p className="text-3xl font-black tracking-[0.18em] text-[#422c36]">
              {profile?.invite_code ?? 'BRAK'}
            </p>
          </div>
          <Button
            fullWidth
            onClick={() => {
              if (!profile?.invite_code) {
                setError('Brakuje kodu zaproszenia. Uruchom najnowszą migrację SQL.')
                return
              }

              void navigator.clipboard?.writeText(profile.invite_code)
              setMessage('Kod skopiowany.')
              showToast('Kod skopiowany.', 'success')
            }}
            variant="secondary"
          >
            <Copy className="mr-2" size={16} />
            Kopiuj kod
          </Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#422c36]">Rola</h2>
              <p className="text-sm text-[#7f6870]">
                Owner zarządza dostępem do aplikacji, ale dalej jest normalnym użytkownikiem.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3f7] px-3 py-1 text-xs font-bold text-[#a54568]">
              <ShieldCheck size={14} />
              {profile?.role === 'owner' ? 'Owner' : 'Member'}
            </span>
          </div>

          {profile?.role === 'owner' ? (
            <Button fullWidth onClick={() => router.push('/dashboard')} variant="secondary">
              Zarządzaj dostępem
            </Button>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-[#422c36]">Twoja para</h2>
          {pairs.length ? (
            pairs.map((pair) => (
              <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={pair.id}>
                <div>
                  <p className="font-bold text-[#422c36]">
                    {profile ? `Ty i ${getPartnerLabel(pair, profile.id)}` : 'Wasza para'}
                  </p>
                  <p className="text-sm text-[#7f6870]">Odłączenie zakończy parę dla obu osób.</p>
                </div>
                <label>
                  <span className="field-label">Twój pseudonim dla tej osoby</span>
                  <input
                    onChange={(event) =>
                      setPartnerNicknames((current) => ({
                        ...current,
                        [pair.id]: event.target.value,
                      }))
                    }
                    placeholder={profile ? getPartnerName(pair, profile.id) : 'np. Misiak'}
                    value={partnerNicknames[pair.id] ?? ''}
                  />
                </label>
                <Button
                  disabled={isPending}
                  fullWidth
                  onClick={() => savePartnerNickname(pair)}
                  variant="secondary"
                >
                  Zapisz pseudonim
                </Button>
                <Button
                  disabled={isPending}
                  fullWidth
                  onClick={() => setPairToLeave(pair)}
                  variant="danger"
                >
                  <Unlink className="mr-2" size={16} />
                  Odłącz mnie od tej pary
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#7f6870]">Nie jesteś teraz w żadnej parze.</p>
          )}
        </Card>

        <Button
          disabled={isPending}
          fullWidth
          onClick={() => setShowSignOutConfirm(true)}
          variant="ghost"
        >
          <LogOut className="mr-2" size={16} />
          Wyloguj
        </Button>
      </main>

      {pairToLeave ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Odłączyć od pary?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                To zakończy tę parę dla obu osób. Zadania i historia zostaną w bazie, ale nie
                będziecie już połączeni.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={isPending} onClick={() => leavePair(pairToLeave)} variant="danger">
                Tak, odłącz
              </Button>
              <Button disabled={isPending} onClick={() => setPairToLeave(null)} variant="secondary">
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}

      {showSignOutConfirm ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Wylogować się?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Wrócisz do ekranu logowania Google. Dane pary i punkty zostaną bez zmian.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={isPending} onClick={signOut} variant="danger">
                Tak, wyloguj
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setShowSignOutConfirm(false)}
                variant="secondary"
              >
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}
      <BottomNav />
    </div>
  )
}
