'use client'

import { Check, Gift, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'

import { LoadingScreen } from '@/components/loading-screen'
import { MemberLoadingScreen } from '@/components/member-loading-screen'
import { MemberShell } from '@/components/member-shell'
import { useAppContext } from '@/components/providers/app-provider'
import { useToast } from '@/components/providers/toast-provider'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ModalOverlay } from '@/components/ui/modal'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import { useBodyScrollLock } from '@/components/use-body-scroll-lock'
import { fetchMyPairs, fetchPairRewards, fetchPairSubmissions, fetchPairTasks } from '@/lib/data'
import { formatDateKey } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import { formatPoints } from '@/lib/points'
import { sendPushNotification } from '@/lib/push'
import type { Tables, TaskType } from '@/lib/supabase/types'

type PhotoMap = Record<string, string>

type TaskForm = {
  title: string
  description: string
  points: string
  type: TaskType
  date: string
  requiresPhoto: boolean
}

type RewardForm = {
  title: string
  description: string
  cost: string
}

const emptyTaskForm: TaskForm = {
  title: '',
  description: '',
  points: '10',
  type: 'daily',
  date: '',
  requiresPhoto: false,
}

const emptyRewardForm: RewardForm = {
  title: '',
  description: '',
  cost: '30',
}

function getPartnerName(pair: Awaited<ReturnType<typeof fetchMyPairs>>[number], profileId: string) {
  const partner = pair.pair_members.find((member) => member.profile_id !== profileId)?.profiles
  return partner?.display_name ?? partner?.email ?? 'partnerem/partnerką'
}

function getPartnerProfileId(
  pair: Awaited<ReturnType<typeof fetchMyPairs>>[number],
  profileId: string,
) {
  return pair.pair_members.find((member) => member.profile_id !== profileId)?.profile_id ?? null
}

function getPartnerLabel(
  pair: Awaited<ReturnType<typeof fetchMyPairs>>[number],
  profileId: string,
) {
  const myMembership = pair.pair_members.find((member) => member.profile_id === profileId)

  return myMembership?.partner_nickname?.trim() || getPartnerName(pair, profileId)
}

export default function PairPage() {
  const router = useRouter()
  const { profile, status, supabase } = useAppContext()
  const { showToast } = useToast()
  const [pair, setPair] = useState<Awaited<ReturnType<typeof fetchMyPairs>>[number] | null>(null)
  const [submissions, setSubmissions] = useState<Awaited<ReturnType<typeof fetchPairSubmissions>>>(
    [],
  )
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof fetchPairTasks>>>([])
  const [rewardsData, setRewardsData] = useState<Awaited<
    ReturnType<typeof fetchPairRewards>
  > | null>(null)
  const [photoUrls, setPhotoUrls] = useState<PhotoMap>({})
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [rewardForm, setRewardForm] = useState<RewardForm>(emptyRewardForm)
  const [partnerNickname, setPartnerNickname] = useState('')
  const [savedPartnerNickname, setSavedPartnerNickname] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Tables<'tasks'> | null>(null)
  const [rewardToDelete, setRewardToDelete] = useState<Tables<'rewards'> | null>(null)
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const [submissionToApprove, setSubmissionToApprove] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const partnerName = pair && profile ? getPartnerLabel(pair, profile.id) : null
  const partnerProfileId = pair && profile ? getPartnerProfileId(pair, profile.id) : null
  const hasOpenModal =
    Boolean(submissionToApprove) ||
    isTaskModalOpen ||
    isRewardModalOpen ||
    Boolean(taskToDelete) ||
    Boolean(rewardToDelete)

  useBodyScrollLock(hasOpenModal)

  const loadData = useEffectEvent(async (showLoader = false) => {
    if (!profile) {
      return
    }

    if (showLoader) {
      setIsLoading(true)
    }

    try {
      const pairs = await fetchMyPairs(supabase, profile.id)
      const activePair = pairs[0] ?? null
      const nextSavedPartnerNickname =
        activePair?.pair_members.find((member) => member.profile_id === profile.id)
          ?.partner_nickname ?? ''
      setPair(activePair)
      setSavedPartnerNickname(nextSavedPartnerNickname)
      setPartnerNickname((current) =>
        current === savedPartnerNickname ? nextSavedPartnerNickname : current,
      )

      if (!activePair) {
        setSubmissions([])
        setTasks([])
        setRewardsData({ rewards: [], redemptions: [] })
        setPhotoUrls({})
        setPartnerNickname('')
        setSavedPartnerNickname('')
        setError(null)
        return
      }

      const [nextSubmissions, nextTasks, nextRewards] = await Promise.all([
        fetchPairSubmissions(supabase, activePair.id),
        fetchPairTasks(supabase, activePair.id, profile.id),
        fetchPairRewards(supabase, activePair.id, profile.id),
      ])

      const partnerSubmissions = nextSubmissions.filter(
        (submission) => submission.profile_id !== profile.id,
      )
      const partnerRedemptions = nextRewards.redemptions.filter(
        (redemption) => redemption.profile_id !== profile.id,
      )

      setSubmissions(partnerSubmissions)
      setTasks(nextTasks)
      setRewardsData({ rewards: nextRewards.rewards, redemptions: partnerRedemptions })
      setError(null)

      const paths = partnerSubmissions.flatMap((submission) =>
        (submission.submission_photos ?? []).map((photo) => photo.storage_path),
      )

      if (paths.length > 0) {
        const signed = await supabase.storage.from('task-photos').createSignedUrls(paths, 60 * 60)

        if (signed.error) {
          throw signed.error
        }

        setPhotoUrls(
          signed.data.reduce<PhotoMap>((accumulator, item, index) => {
            const path = paths[index]
            if (item.signedUrl) {
              accumulator[path] = item.signedUrl
            }
            return accumulator
          }, {}),
        )
      } else {
        setPhotoUrls({})
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Nie udało się wczytać pary.'))
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

  const reviewSubmission = (submissionId: string, action: 'approve' | 'reject' | 'reset') => {
    if (!profile) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)
        const submission = submissions.find((item) => item.id === submissionId)

        const response = await supabase.rpc('review_submission', {
          p_action: action,
          p_reviewer_profile_id: profile.id,
          p_rejection_reason: action === 'reject' ? rejectionReasons[submissionId] : null,
          p_submission_id: submissionId,
        })

        if (response.error) {
          throw response.error
        }

        const nextMessage =
          action === 'approve'
            ? 'Zgłoszenie zaakceptowane, punkty dodane.'
            : action === 'reject'
              ? 'Zgłoszenie odrzucone.'
              : 'Akceptacja cofnięta, punkty odjęte.'
        setMessage(nextMessage)
        showToast(nextMessage, action === 'approve' ? 'success' : 'info')
        if (submission && action !== 'reset') {
          await sendPushNotification(supabase, {
            body:
              action === 'approve'
                ? `Zaakceptowano zadanie: ${submission.tasks?.title ?? 'Zadanie'}`
                : `Odrzucono zadanie: ${submission.tasks?.title ?? 'Zadanie'}`,
            recipientProfileIds: [submission.profile_id],
            title: action === 'approve' ? 'Punkty dodane' : 'Zadanie odrzucone',
            url: '/',
          })
        }
        await loadData(false)
      } catch (caughtError) {
        const nextError = getErrorMessage(caughtError, 'Nie udało się zmienić zgłoszenia.')
        setError(nextError)
        showToast(nextError, 'error')
      }
    })
  }

  const savePartnerNickname = () => {
    if (!profile || !pair) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        setMessage(null)

        const response = await supabase.rpc('update_partner_nickname', {
          p_pair_id: pair.id,
          p_partner_nickname: partnerNickname,
          p_profile_id: profile.id,
        })

        if (response.error) {
          throw response.error
        }

        setSavedPartnerNickname(partnerNickname)
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

  const openCreateTaskModal = () => {
    setEditingTaskId(null)
    setTaskForm(emptyTaskForm)
    setIsTaskModalOpen(true)
    setError(null)
    setMessage(null)
  }

  const startEditingTask = (task: Tables<'tasks'>) => {
    setEditingTaskId(task.id)
    setTaskForm({
      date: task.date ?? '',
      description: task.description ?? '',
      points: String(task.points),
      requiresPhoto: task.requires_photo,
      title: task.title,
      type: task.type,
    })
    setIsTaskModalOpen(true)
    setError(null)
    setMessage(null)
  }

  const closeTaskModal = () => {
    setEditingTaskId(null)
    setTaskForm(emptyTaskForm)
    setIsTaskModalOpen(false)
  }

  const openCreateRewardModal = () => {
    setEditingRewardId(null)
    setRewardForm(emptyRewardForm)
    setIsRewardModalOpen(true)
    setError(null)
    setMessage(null)
  }

  const startEditingReward = (reward: Tables<'rewards'>) => {
    setEditingRewardId(reward.id)
    setRewardForm({
      cost: String(reward.cost),
      description: reward.description ?? '',
      title: reward.title,
    })
    setIsRewardModalOpen(true)
    setError(null)
    setMessage(null)
  }

  const closeRewardModal = () => {
    setEditingRewardId(null)
    setRewardForm(emptyRewardForm)
    setIsRewardModalOpen(false)
  }

  if (isLoading) {
    return status === 'ready' ? (
      <MemberLoadingScreen label="Ładowanie pary..." />
    ) : (
      <LoadingScreen label="Ładowanie pary..." />
    )
  }

  return (
    <MemberShell>
      <main className="section-stack">
        <section className="space-y-2 px-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">Para</p>
          <h1 className="text-3xl font-black text-[#422c36]">
            {partnerName ? `Ty i ${partnerName}` : 'Połączcie się w parę'}
          </h1>
          <p className="text-sm leading-6 text-[#7f6870]">
            Tutaj ogarniacie zgłoszenia, zadania i nagrody w Waszej parze.
          </p>
        </section>

        {message ? <Card className="bg-[#eefaf3] text-sm text-[#2f7753]">{message}</Card> : null}
        {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

        {!pair ? (
          <Card className="text-sm leading-6 text-[#7f6870]">
            Najpierw połącz się kodem drugiej osoby na ekranie „Dzisiaj”.
          </Card>
        ) : (
          <>
            <div className="section-stack lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
              <Card className="space-y-4">
                <h2 className="text-lg font-bold text-[#422c36]">
                  {partnerName ? `Zgłoszenia od ${partnerName}` : 'Zgłoszenia partnera'}
                </h2>
                {submissions.length ? (
                  submissions.map((submission) => (
                    <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={submission.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[#422c36]">
                            {submission.tasks?.title ?? 'Zadanie'}
                          </p>
                          <p className="text-sm text-[#7f6870]">
                            {formatDateKey(submission.submission_date)} ·{' '}
                            {submission.member_profile?.display_name ??
                              submission.member_profile?.email ??
                              'Użytkownik'}
                          </p>
                        </div>
                        <StatusBadge status={submission.status} />
                      </div>

                      {submission.submission_photos?.length ? (
                        <div className="grid grid-cols-3 gap-2">
                          {submission.submission_photos.map((photo) =>
                            photoUrls[photo.storage_path] ? (
                              /* biome-ignore lint/performance/noImgElement: signed Supabase URLs are shown directly for private task proofs. */
                              <img
                                alt="Zdjęcie zgłoszenia"
                                className="aspect-square w-full rounded-2xl object-cover"
                                key={photo.id}
                                src={photoUrls[photo.storage_path]}
                              />
                            ) : null,
                          )}
                        </div>
                      ) : null}

                      {submission.rejection_reason ? (
                        <p className="text-sm text-[#a2435f]">{submission.rejection_reason}</p>
                      ) : null}

                      {submission.status === 'pending' ? (
                        <div className="space-y-2">
                          <input
                            onChange={(event) =>
                              setRejectionReasons((current) => ({
                                ...current,
                                [submission.id]: event.target.value,
                              }))
                            }
                            placeholder="Powód odrzucenia, jeśli odrzucasz"
                            value={rejectionReasons[submission.id] ?? ''}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              disabled={isPending}
                              onClick={() => setSubmissionToApprove(submission.id)}
                            >
                              <Check className="mr-2" size={16} />
                              Akceptuj
                            </Button>
                            <Button
                              disabled={isPending}
                              onClick={() => reviewSubmission(submission.id, 'reject')}
                              variant="danger"
                            >
                              <X className="mr-2" size={16} />
                              Odrzuć
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#7f6870]">
                    {partnerName
                      ? `${partnerName} nie ma jeszcze zgłoszeń do sprawdzenia.`
                      : 'Nie ma jeszcze zgłoszeń partnera do sprawdzenia.'}
                  </p>
                )}
              </Card>

              <Card className="space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-[#422c36]">Pseudonim połówki</h2>
                  <p className="text-sm leading-6 text-[#7f6870]">
                    To jest tylko Twoja nazwa dla tej osoby. Jej własna nazwa profilu zostaje bez
                    zmian.
                  </p>
                </div>
                <label>
                  <span className="field-label">Jak chcesz ją/go widzieć?</span>
                  <input
                    onChange={(event) => setPartnerNickname(event.target.value)}
                    placeholder={partnerName ?? 'np. Misiak'}
                    value={partnerNickname}
                  />
                </label>
                <Button
                  disabled={isPending}
                  fullWidth
                  onClick={savePartnerNickname}
                  variant="secondary"
                >
                  Zapisz pseudonim
                </Button>
              </Card>
            </div>

            <div className="section-stack lg:grid lg:grid-cols-2 lg:items-start">
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#422c36]">
                      {partnerName ? `Zadania dla ${partnerName}` : 'Zadania dla partnera'}
                    </h2>
                    <p className="text-sm text-[#7f6870]">
                      To są zadania, które ustawiasz drugiej osobie.
                    </p>
                  </div>
                  <Button disabled={isPending} onClick={openCreateTaskModal}>
                    <Plus className="mr-2" size={16} />
                    Dodaj
                  </Button>
                </div>

                <div className="space-y-2">
                  {tasks.length ? (
                    tasks.map((task) => (
                      <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={task.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#422c36]">{task.title}</p>
                            <p className="text-sm text-[#7f6870]">
                              {formatPoints(task.points)} · {task.active ? 'Aktywne' : 'Wyłączone'}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#8a6674]">
                            {task.type === 'daily' ? 'Codziennie' : 'Jednorazowe'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            disabled={isPending}
                            onClick={() => startEditingTask(task)}
                            variant="secondary"
                          >
                            <Pencil className="mr-2" size={14} />
                            Edytuj
                          </Button>
                          <Button
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const response = await supabase
                                  .from('tasks')
                                  .update({ active: !task.active })
                                  .eq('id', task.id)

                                if (response.error) {
                                  setError(response.error.message)
                                  return
                                }

                                await loadData(false)
                              })
                            }}
                            variant="ghost"
                          >
                            {task.active ? 'Wyłącz' : 'Włącz'}
                          </Button>
                          <Button
                            disabled={isPending}
                            onClick={() => setTaskToDelete(task)}
                            variant="danger"
                          >
                            <Trash2 className="mr-2" size={14} />
                            Usuń
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#7f6870]">Nie ma jeszcze żadnych zadań.</p>
                  )}
                </div>
              </Card>

              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#422c36]">
                      {partnerName ? `Nagrody dla ${partnerName}` : 'Nagrody dla partnera'}
                    </h2>
                    <p className="text-sm text-[#7f6870]">
                      To są nagrody, które druga osoba może odebrać za swoje punkty.
                    </p>
                  </div>
                  <Button disabled={isPending} onClick={openCreateRewardModal}>
                    <Plus className="mr-2" size={16} />
                    Dodaj
                  </Button>
                </div>

                <div className="space-y-2">
                  {rewardsData?.rewards.length ? (
                    rewardsData.rewards.map((reward) => (
                      <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={reward.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#422c36]">{reward.title}</p>
                            <p className="text-sm text-[#7f6870]">
                              {formatPoints(reward.cost)} ·{' '}
                              {reward.active ? 'Aktywna' : 'Wyłączona'}
                            </p>
                          </div>
                          <Gift className="text-[#d34d7d]" size={18} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            disabled={isPending}
                            onClick={() => startEditingReward(reward)}
                            variant="secondary"
                          >
                            <Pencil className="mr-2" size={14} />
                            Edytuj
                          </Button>
                          <Button
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                const response = await supabase
                                  .from('rewards')
                                  .update({ active: !reward.active })
                                  .eq('id', reward.id)

                                if (response.error) {
                                  setError(response.error.message)
                                  return
                                }

                                await loadData(false)
                              })
                            }}
                            variant="ghost"
                          >
                            {reward.active ? 'Wyłącz' : 'Włącz'}
                          </Button>
                          <Button
                            disabled={isPending}
                            onClick={() => setRewardToDelete(reward)}
                            variant="danger"
                          >
                            <Trash2 className="mr-2" size={14} />
                            Usuń
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#7f6870]">Nie ma jeszcze żadnych nagród.</p>
                  )}
                </div>

                {rewardsData?.redemptions.length ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#c65b84]">
                      Odbiory
                    </h3>
                    {rewardsData.redemptions.map((redemption) => (
                      <div className="rounded-3xl bg-[#fff8fb] p-4" key={redemption.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#422c36]">
                              {redemption.reward_title}
                            </p>
                            <p className="text-sm text-[#7f6870]">
                              {redemption.profiles?.display_name ?? redemption.profiles?.email} ·{' '}
                              {redemption.status === 'fulfilled' ? 'Zrealizowana' : 'Oczekuje'}
                            </p>
                          </div>
                          <Gift className="text-[#d34d7d]" size={18} />
                        </div>
                        {redemption.status === 'requested' ? (
                          <Button
                            className="mt-3"
                            disabled={isPending}
                            fullWidth
                            onClick={() => {
                              startTransition(async () => {
                                const response = await supabase
                                  .from('reward_redemptions')
                                  .update({
                                    fulfilled_at: new Date().toISOString(),
                                    status: 'fulfilled',
                                  })
                                  .eq('id', redemption.id)

                                if (response.error) {
                                  setError(response.error.message)
                                  return
                                }

                                await sendPushNotification(supabase, {
                                  body: `Nagroda "${redemption.reward_title}" została oznaczona jako zrealizowana.`,
                                  recipientProfileIds: [redemption.profile_id],
                                  title: 'Nagroda zrealizowana',
                                  url: '/history',
                                })
                                await loadData(false)
                              })
                            }}
                            variant="secondary"
                          >
                            Oznacz jako zrealizowaną
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          </>
        )}
      </main>

      {submissionToApprove ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Zaakceptować zgłoszenie?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Po akceptacji punkty zostaną dodane osobie: {partnerName ?? 'partner/partnerka'}.
                Tej akcji nie cofamy z poziomu aplikacji.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  const submissionId = submissionToApprove
                  setSubmissionToApprove(null)
                  reviewSubmission(submissionId, 'approve')
                }}
              >
                Tak, akceptuj
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setSubmissionToApprove(null)}
                variant="secondary"
              >
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}

      {isTaskModalOpen ? (
        <ModalOverlay>
          <Card className="max-h-full w-full max-w-md space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                  Zadanie
                </p>
                <h2 className="text-xl font-black text-[#422c36]">
                  {editingTaskId ? 'Edytuj zadanie' : 'Dodaj zadanie'}
                </h2>
              </div>
              <button
                className="rounded-full bg-[#fff3f7] p-2 text-[#8d6f79]"
                onClick={closeTaskModal}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()

                startTransition(async () => {
                  if (!pair || !profile || !partnerProfileId) {
                    setError('Nie udało się znaleźć drugiej osoby w tej parze.')
                    return
                  }

                  const points = Number(taskForm.points)
                  if (!taskForm.title.trim() || !Number.isInteger(points) || points <= 0) {
                    setError('Zadanie musi mieć tytuł i dodatnią liczbę punktów.')
                    return
                  }

                  if (taskForm.type === 'one_time' && !taskForm.date) {
                    setError('Zadanie jednorazowe musi mieć datę.')
                    return
                  }

                  const payload = {
                    date: taskForm.type === 'one_time' ? taskForm.date : null,
                    description: taskForm.description.trim() || null,
                    points,
                    requires_photo: taskForm.requiresPhoto,
                    title: taskForm.title.trim(),
                    type: taskForm.type,
                  }

                  const response = editingTaskId
                    ? await supabase.from('tasks').update(payload).eq('id', editingTaskId)
                    : await supabase.from('tasks').insert({
                        ...payload,
                        active: true,
                        created_by_profile_id: profile.id,
                        pair_id: pair.id,
                        target_profile_id: partnerProfileId,
                      })

                  if (response.error) {
                    setError(response.error.message)
                    return
                  }

                  closeTaskModal()
                  setMessage(editingTaskId ? 'Zadanie zostało zapisane.' : 'Zadanie dodane.')
                  await loadData(false)
                })
              }}
            >
              <input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Tytuł zadania"
                value={taskForm.title}
              />
              <input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Opis opcjonalny"
                value={taskForm.description}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  min="1"
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, points: event.target.value }))
                  }
                  type="number"
                  value={taskForm.points}
                />
                <select
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      type: event.target.value as TaskType,
                    }))
                  }
                  value={taskForm.type}
                >
                  <option value="daily">Codziennie</option>
                  <option value="one_time">Jednorazowe</option>
                </select>
              </div>
              {taskForm.type === 'one_time' ? (
                <input
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, date: event.target.value }))
                  }
                  type="date"
                  value={taskForm.date}
                />
              ) : null}
              <label className="flex items-center gap-3 rounded-3xl bg-[#fff8fb] px-4 py-3 text-sm font-semibold text-[#6f5862]">
                <input
                  checked={taskForm.requiresPhoto}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      requiresPhoto: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Wymaga zdjęcia
              </label>
              <Button disabled={isPending} fullWidth type="submit">
                {editingTaskId ? 'Zapisz zadanie' : 'Dodaj zadanie'}
              </Button>
            </form>
          </Card>
        </ModalOverlay>
      ) : null}

      {isRewardModalOpen ? (
        <ModalOverlay>
          <Card className="max-h-full w-full max-w-md space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                  Nagroda
                </p>
                <h2 className="text-xl font-black text-[#422c36]">
                  {editingRewardId ? 'Edytuj nagrodę' : 'Dodaj nagrodę'}
                </h2>
              </div>
              <button
                className="rounded-full bg-[#fff3f7] p-2 text-[#8d6f79]"
                onClick={closeRewardModal}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()

                startTransition(async () => {
                  if (!pair || !profile || !partnerProfileId) {
                    setError('Nie udało się znaleźć drugiej osoby w tej parze.')
                    return
                  }

                  const cost = Number(rewardForm.cost)
                  if (!rewardForm.title.trim() || !Number.isInteger(cost) || cost <= 0) {
                    setError('Nagroda musi mieć tytuł i dodatni koszt.')
                    return
                  }

                  const payload = {
                    cost,
                    description: rewardForm.description.trim() || null,
                    title: rewardForm.title.trim(),
                  }

                  const response = editingRewardId
                    ? await supabase.from('rewards').update(payload).eq('id', editingRewardId)
                    : await supabase.from('rewards').insert({
                        ...payload,
                        active: true,
                        created_by_profile_id: profile.id,
                        pair_id: pair.id,
                        target_profile_id: partnerProfileId,
                      })

                  if (response.error) {
                    setError(response.error.message)
                    return
                  }

                  closeRewardModal()
                  setMessage(editingRewardId ? 'Nagroda została zapisana.' : 'Nagroda dodana.')
                  await loadData(false)
                })
              }}
            >
              <input
                onChange={(event) =>
                  setRewardForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Tytuł nagrody"
                value={rewardForm.title}
              />
              <input
                onChange={(event) =>
                  setRewardForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Opis opcjonalny"
                value={rewardForm.description}
              />
              <input
                min="1"
                onChange={(event) =>
                  setRewardForm((current) => ({ ...current, cost: event.target.value }))
                }
                type="number"
                value={rewardForm.cost}
              />
              <Button disabled={isPending} fullWidth type="submit">
                {editingRewardId ? 'Zapisz nagrodę' : 'Dodaj nagrodę'}
              </Button>
            </form>
          </Card>
        </ModalOverlay>
      ) : null}

      {taskToDelete ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Usunąć zadanie?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Zadanie „{taskToDelete.title}” zniknie z listy. Jeśli ma już zgłoszenia w historii,
                baza może odmówić usunięcia. Wtedy najlepiej je wyłączyć.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  const selectedTask = taskToDelete

                  startTransition(async () => {
                    try {
                      setError(null)
                      setMessage(null)
                      setTaskToDelete(null)

                      const response = await supabase
                        .from('tasks')
                        .delete()
                        .eq('id', selectedTask.id)

                      if (response.error) {
                        throw response.error
                      }

                      setMessage('Zadanie zostało usunięte.')
                      if (editingTaskId === selectedTask.id) {
                        closeTaskModal()
                      }
                      await loadData(false)
                    } catch (caughtError) {
                      setError(
                        getErrorMessage(
                          caughtError,
                          'Nie udało się usunąć zadania. Jeśli ma historię, wyłącz je zamiast usuwać.',
                        ),
                      )
                    }
                  })
                }}
                variant="danger"
              >
                Tak, usuń
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setTaskToDelete(null)}
                variant="secondary"
              >
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}

      {rewardToDelete ? (
        <ModalOverlay>
          <Card className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Potwierdzenie
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Usunąć nagrodę?</h2>
              <p className="text-sm leading-6 text-[#7f6870]">
                Nagroda „{rewardToDelete.title}” zniknie z listy. Jeśli była już odbierana, baza
                może odmówić usunięcia. Wtedy najlepiej ją wyłączyć.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  const selectedReward = rewardToDelete

                  startTransition(async () => {
                    try {
                      setError(null)
                      setMessage(null)
                      setRewardToDelete(null)

                      const response = await supabase
                        .from('rewards')
                        .delete()
                        .eq('id', selectedReward.id)

                      if (response.error) {
                        throw response.error
                      }

                      setMessage('Nagroda została usunięta.')
                      if (editingRewardId === selectedReward.id) {
                        closeRewardModal()
                      }
                      await loadData(false)
                    } catch (caughtError) {
                      setError(
                        getErrorMessage(
                          caughtError,
                          'Nie udało się usunąć nagrody. Jeśli ma historię, wyłącz ją zamiast usuwać.',
                        ),
                      )
                    }
                  })
                }}
                variant="danger"
              >
                Tak, usuń
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setRewardToDelete(null)}
                variant="secondary"
              >
                Anuluj
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      ) : null}
    </MemberShell>
  )
}
