'use client'

import { Copy, HeartHandshake, ImagePlus, Link2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'

import { BalanceCard } from '@/components/balance-card'
import { LoadingScreen } from '@/components/loading-screen'
import { MemberLoadingScreen } from '@/components/member-loading-screen'
import { MemberShell } from '@/components/member-shell'
import { PhotoUploader } from '@/components/photo-uploader'
import { useAppContext } from '@/components/providers/app-provider'
import { useToast } from '@/components/providers/toast-provider'
import { TaskCard } from '@/components/task-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModalOverlay } from '@/components/ui/modal'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import { useBodyScrollLock } from '@/components/use-body-scroll-lock'
import {
  fetchMemberBalance,
  fetchMyPairs,
  fetchPairRequests,
  fetchTodayTasks,
  type PairRequestWithProfiles,
  type PairWithMembers,
  type TodayTaskItem,
} from '@/lib/data'
import { getLongTodayLabel, getTodayDateKey } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import { sendPushNotification } from '@/lib/push'
import { validatePhotoFiles } from '@/lib/validation'

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
}

function getPartnerName(pair: PairWithMembers, profileId: string) {
  const myMembership = pair.pair_members.find((member) => member.profile_id === profileId)
  const partner = pair.pair_members.find((member) => member.profile_id !== profileId)?.profiles
  return (
    myMembership?.partner_nickname?.trim() ||
    partner?.display_name ||
    partner?.email ||
    'partner/partnerka'
  )
}

export default function HomePage() {
  const router = useRouter()
  const { authUserId, profile, status, supabase } = useAppContext()
  const { showToast } = useToast()
  const [activePair, setActivePair] = useState<PairWithMembers | null>(null)
  const [pairRequests, setPairRequests] = useState<PairRequestWithProfiles[]>([])
  const [tasks, setTasks] = useState<TodayTaskItem[]>([])
  const [balance, setBalance] = useState(0)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TodayTaskItem | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useBodyScrollLock(Boolean(selectedTask))

  const loadData = useEffectEvent(async (showLoader = false) => {
    if (!profile) {
      return
    }

    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const nextPairs = await fetchMyPairs(supabase, profile.id)
      const nextActivePair = nextPairs[0] ?? null
      setActivePair(nextActivePair)

      if (!nextActivePair) {
        const requests = await fetchPairRequests(supabase, profile.id)
        setPairRequests(requests)
        setTasks([])
        setBalance(0)
        setError(null)
        return
      }

      const todayKey = getTodayDateKey()
      const [todayTasks, balanceState] = await Promise.all([
        fetchTodayTasks(supabase, nextActivePair.id, profile.id, todayKey),
        fetchMemberBalance(supabase, profile.id, nextActivePair.id),
      ])

      setTasks(todayTasks)
      setPairRequests([])
      setBalance(balanceState.balance)
      setError(null)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Nie udało się wczytać aplikacji.',
      )
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

  const respondToPairRequest = (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
    if (!profile) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)

        const request = pairRequests.find((pairRequest) => pairRequest.id === requestId)
        const response = await supabase.rpc('respond_pair_request', {
          p_action: action,
          p_profile_id: profile.id,
          p_request_id: requestId,
        })

        if (response.error) {
          throw response.error
        }

        const nextMessage =
          action === 'accept'
            ? 'Prośba zaakceptowana. Jesteście połączeni.'
            : action === 'reject'
              ? 'Prośba została odrzucona.'
              : 'Prośba została anulowana.'
        setMessage(nextMessage)
        showToast(nextMessage, action === 'accept' ? 'success' : 'info')
        if (request && action !== 'cancel') {
          await sendPushNotification(supabase, {
            body:
              action === 'accept'
                ? `${profile.display_name ?? 'Druga osoba'} zaakceptowała prośbę o połączenie.`
                : `${profile.display_name ?? 'Druga osoba'} odrzuciła prośbę o połączenie.`,
            recipientProfileIds: [request.requester_profile_id],
            title: 'Prośba o połączenie',
            url: '/',
          })
        }
        await loadData(true)
      } catch (caughtError) {
        const nextError = getErrorMessage(caughtError, 'Nie udało się zmienić prośby.')
        setError(nextError)
        showToast(nextError, 'error')
      }
    })
  }

  if (status === 'loading') {
    return <LoadingScreen label="Ładowanie aplikacji..." />
  }

  if (!profile) {
    return <LoadingScreen label="Przekierowanie..." />
  }

  if (isLoading) {
    return <MemberLoadingScreen label="Ładowanie aplikacji..." />
  }

  if (!activePair) {
    const incomingRequests = pairRequests.filter(
      (request) => request.recipient_profile_id === profile.id,
    )
    const outgoingRequests = pairRequests.filter(
      (request) => request.requester_profile_id === profile.id,
    )

    return (
      <MemberShell>
        <main className="section-stack">
          <section className="space-y-2 px-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
              Pink Day
            </p>
            <h1 className="text-3xl font-black text-[#422c36]">Połącz się w parę</h1>
            <p className="text-sm leading-6 text-[#7f6870]">
              Daj drugiej osobie swój kod albo wpisz jej kod. Nie tworzysz pokoju, tylko łączycie
              swoje dwa konta po zaakceptowaniu prośby.
            </p>
          </section>

          {message ? <Card className="bg-[#eefaf3] text-sm text-[#2f7753]">{message}</Card> : null}
          {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

          <Card className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-[#fff0f6] p-3 text-[#d34d7d]">
                <HeartHandshake size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#422c36]">Twój kod zaproszenia</h2>
                <p className="text-sm text-[#7f6870]">
                  Wyślij go osobie, z którą chcesz się połączyć.
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-[#fff8fb] px-5 py-4">
              <p className="text-3xl font-black tracking-[0.18em] text-[#422c36]">
                {profile.invite_code ?? 'BRAK'}
              </p>
            </div>

            <Button
              fullWidth
              onClick={() => {
                if (!profile.invite_code) {
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
              Kopiuj mój kod
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-[#fff0f6] p-3 text-[#d34d7d]">
                <Link2 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#422c36]">Wpisz kod drugiej osoby</h2>
                <p className="text-sm text-[#7f6870]">
                  Po poprawnym kodzie wyślesz prośbę o połączenie.
                </p>
              </div>
            </div>

            <label>
              <span className="field-label">Kod zaproszenia</span>
              <input
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABCD1234"
                value={joinCode}
              />
            </label>

            <Button
              disabled={isPending}
              fullWidth
              onClick={() => {
                startTransition(async () => {
                  try {
                    setError(null)
                    setMessage(null)

                    const response = await supabase.rpc('request_pair_by_code', {
                      p_invite_code: joinCode.trim(),
                      p_profile_id: profile.id,
                    })

                    if (response.error) {
                      throw response.error
                    }

                    setJoinCode('')
                    setMessage('Prośba o połączenie została wysłana.')
                    showToast('Prośba o połączenie została wysłana.', 'success')
                    const requests = await fetchPairRequests(supabase, profile.id)
                    const createdRequest = requests.find((request) => request.id === response.data)
                    if (createdRequest) {
                      await sendPushNotification(supabase, {
                        body: `${profile.display_name ?? 'Ktoś'} wysłał(a) prośbę o połączenie.`,
                        recipientProfileIds: [createdRequest.recipient_profile_id],
                        title: 'Nowa prośba o połączenie',
                        url: '/',
                      })
                    }
                    await loadData(true)
                  } catch (caughtError) {
                    const nextError =
                      caughtError instanceof Error
                        ? caughtError.message
                        : 'Nie udało się wysłać prośby.'
                    setError(nextError)
                    showToast(nextError, 'error')
                  }
                })
              }}
              variant="secondary"
            >
              Wyślij prośbę
            </Button>
          </Card>

          {incomingRequests.length ? (
            <Card className="space-y-4">
              <h2 className="text-lg font-bold text-[#422c36]">Prośby do Ciebie</h2>
              {incomingRequests.map((request) => (
                <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={request.id}>
                  <div>
                    <p className="font-bold text-[#422c36]">
                      {request.requester?.display_name ?? request.requester?.email ?? 'Ktoś'}
                    </p>
                    <p className="text-sm text-[#7f6870]">chce połączyć się z Tobą w parę.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      disabled={isPending}
                      onClick={() => respondToPairRequest(request.id, 'accept')}
                    >
                      Akceptuj
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={() => respondToPairRequest(request.id, 'reject')}
                      variant="danger"
                    >
                      Odrzuć
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          ) : null}

          {outgoingRequests.length ? (
            <Card className="space-y-4">
              <h2 className="text-lg font-bold text-[#422c36]">Wysłane prośby</h2>
              {outgoingRequests.map((request) => (
                <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={request.id}>
                  <div>
                    <p className="font-bold text-[#422c36]">
                      {request.recipient?.display_name ?? request.recipient?.email ?? 'Ktoś'}
                    </p>
                    <p className="text-sm text-[#7f6870]">czeka na zaakceptowanie prośby.</p>
                  </div>
                  <Button
                    disabled={isPending}
                    fullWidth
                    onClick={() => respondToPairRequest(request.id, 'cancel')}
                    variant="secondary"
                  >
                    Anuluj prośbę
                  </Button>
                </div>
              ))}
            </Card>
          ) : null}
        </main>
      </MemberShell>
    )
  }

  return (
    <MemberShell>
      <main className="section-stack">
        <div className="section-stack lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="space-y-2 px-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
              Wasza para
            </p>
            <h1 className="text-3xl font-black text-[#422c36] lg:text-4xl">
              {getLongTodayLabel()}
            </h1>
            <p className="text-sm leading-6 text-[#7f6870]">
              Połączono z:{' '}
              <span className="font-bold text-[#422c36]">
                {getPartnerName(activePair, profile.id)}
              </span>
            </p>
          </section>

          <BalanceCard balance={balance} />
        </div>

        {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

        <section className="section-stack lg:grid lg:grid-cols-2 lg:items-start">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                onSubmit={(currentTask) => {
                  if (
                    currentTask.latestSubmission &&
                    (currentTask.latestSubmission.status === 'pending' ||
                      currentTask.latestSubmission.status === 'approved')
                  ) {
                    setError('To zadanie zostało już dziś wysłane.')
                    showToast('To zadanie zostało już dziś wysłane.', 'info')
                    return
                  }

                  setSelectedTask(currentTask)
                  setFiles([])
                  setSubmissionError(null)
                  setError(null)
                }}
                task={task}
              />
            ))
          ) : (
            <Card className="text-center text-sm text-[#7f6870]">
              Ta para nie ma jeszcze aktywnych zadań.
            </Card>
          )}
        </section>

        {selectedTask ? (
          <ModalOverlay>
            <Card className="max-h-full w-full max-w-md overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#7b5e69]">Wyślij wykonanie</p>
                  <h2 className="text-xl font-black text-[#422c36]">{selectedTask.title}</h2>
                </div>
                <button
                  className="rounded-full bg-[#fff3f7] p-2 text-[#8d6f79]"
                  onClick={() => {
                    setSelectedTask(null)
                    setSubmissionError(null)
                  }}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-3xl bg-[#fff8fb] p-4 text-sm text-[#7f6870]">
                  {selectedTask.requires_photo ? (
                    <div className="flex items-start gap-2">
                      <ImagePlus className="mt-0.5 shrink-0 text-[#cf5b84]" size={16} />
                      To zadanie wymaga od 1 do 3 zdjęć.
                    </div>
                  ) : (
                    'Zdjęcie jest opcjonalne.'
                  )}
                </div>

                <PhotoUploader files={files} onChange={setFiles} />

                <Button
                  disabled={isPending}
                  fullWidth
                  onClick={() => {
                    startTransition(async () => {
                      if (!authUserId || !selectedTask) {
                        return
                      }

                      const validationError = validatePhotoFiles(files, selectedTask.requires_photo)
                      if (validationError) {
                        setSubmissionError(validationError)
                        return
                      }

                      let createdSubmissionId: string | null = null
                      const uploadedPaths: string[] = []

                      try {
                        const createdSubmission = await supabase
                          .from('task_submissions')
                          .insert({
                            pair_id: activePair.id,
                            task_id: selectedTask.id,
                            profile_id: profile.id,
                            submission_date: getTodayDateKey(),
                            status: 'pending',
                          })
                          .select('*')
                          .single()

                        if (createdSubmission.error) {
                          throw createdSubmission.error
                        }

                        createdSubmissionId = createdSubmission.data.id

                        if (files.length > 0) {
                          for (const file of files) {
                            const filePath = `${activePair.id}/${authUserId}/${createdSubmissionId}/${Date.now()}-${sanitizeFileName(file.name)}`
                            const uploadResponse = await supabase.storage
                              .from('task-photos')
                              .upload(filePath, file, { upsert: false })

                            if (uploadResponse.error) {
                              throw uploadResponse.error
                            }

                            uploadedPaths.push(filePath)
                          }

                          const photosInsert = await supabase.from('submission_photos').insert(
                            uploadedPaths.map((storagePath) => ({
                              submission_id: createdSubmissionId as string,
                              storage_path: storagePath,
                            })),
                          )

                          if (photosInsert.error) {
                            throw photosInsert.error
                          }
                        }

                        setSelectedTask(null)
                        setSubmissionError(null)
                        setFiles([])
                        if (
                          selectedTask.created_by_profile_id &&
                          selectedTask.created_by_profile_id !== profile.id
                        ) {
                          await sendPushNotification(supabase, {
                            body: `${profile.display_name ?? 'Ktoś'} wysłał(a): ${selectedTask.title}`,
                            recipientProfileIds: [selectedTask.created_by_profile_id],
                            title: 'Nowe zgłoszenie zadania',
                            url: '/pair',
                          })
                        }
                        await loadData(false)
                      } catch (caughtError) {
                        if (uploadedPaths.length > 0) {
                          await supabase.storage.from('task-photos').remove(uploadedPaths)
                        }

                        if (createdSubmissionId) {
                          await supabase
                            .from('task_submissions')
                            .delete()
                            .eq('id', createdSubmissionId)
                        }

                        setSubmissionError(
                          getErrorMessage(caughtError, 'Nie udało się wysłać zgłoszenia.'),
                        )
                      }
                    })
                  }}
                >
                  {isPending ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
                </Button>

                {submissionError ? (
                  <div className="rounded-3xl bg-[#fff1f4] p-4 text-sm text-[#a2435f]">
                    {submissionError}
                  </div>
                ) : null}
              </div>
            </Card>
          </ModalOverlay>
        ) : null}
      </main>
    </MemberShell>
  )
}
