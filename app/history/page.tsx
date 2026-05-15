'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState } from 'react'

import { BottomNav } from '@/components/bottom-nav'
import { LoadingScreen } from '@/components/loading-screen'
import { MemberLoadingScreen } from '@/components/member-loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { StatusBadge } from '@/components/status-badge'
import { Card } from '@/components/ui/card'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import {
  fetchMemberHistory,
  fetchMyPairs,
  fetchPairStats,
  type PairStatsData,
  type PairWithMembers,
} from '@/lib/data'
import { daysAgoDateKey, formatDateKey, getTodayDateKey, shiftDateKey } from '@/lib/dates'
import { formatPoints } from '@/lib/points'
import type { Tables } from '@/lib/supabase/types'

type PhotoMap = Record<string, string>

type PersonStats = {
  approvedLast30Days: number
  approvedLast7Days: number
  approvedToday: number
  bestStreak: number
  currentStreak: number
  displayName: string
  earnedPoints: number
  profileId: string
  redeemedRewards: number
}

function getProfileLabel(profile: Tables<'profiles'> | null, fallback: string) {
  return profile?.display_name ?? profile?.email ?? fallback
}

function getCurrentStreak(approvedDates: Set<string>) {
  const today = getTodayDateKey()
  let cursor = approvedDates.has(today) ? today : shiftDateKey(today, -1)
  let streak = 0

  while (approvedDates.has(cursor)) {
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return streak
}

function getBestStreak(approvedDates: Set<string>) {
  const sortedDates = [...approvedDates].sort()
  let best = 0
  let current = 0
  let previous: string | null = null

  for (const date of sortedDates) {
    if (previous && shiftDateKey(previous, 1) === date) {
      current += 1
    } else {
      current = 1
    }

    best = Math.max(best, current)
    previous = date
  }

  return best
}

function buildStats(
  pair: PairWithMembers | null,
  stats: PairStatsData | null,
  viewerProfileId: string | null,
) {
  if (!pair || !stats) {
    return []
  }

  const today = getTodayDateKey()
  const sevenDaysAgo = daysAgoDateKey(6)
  const thirtyDaysAgo = daysAgoDateKey(29)

  return pair.pair_members.map<PersonStats>((member, index) => {
    const approvedSubmissions = stats.submissions.filter(
      (submission) =>
        submission.profile_id === member.profile_id && submission.status === 'approved',
    )
    const approvedDates = new Set(
      approvedSubmissions.map((submission) => submission.submission_date),
    )
    const earnedPoints = stats.transactions
      .filter(
        (transaction) =>
          transaction.profile_id === member.profile_id &&
          transaction.reason === 'task_approved' &&
          transaction.amount > 0,
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const redeemedRewards = stats.redemptions.filter(
      (redemption) => redemption.profile_id === member.profile_id,
    ).length

    return {
      approvedLast30Days: approvedSubmissions.filter(
        (submission) => submission.submission_date >= thirtyDaysAgo,
      ).length,
      approvedLast7Days: approvedSubmissions.filter(
        (submission) => submission.submission_date >= sevenDaysAgo,
      ).length,
      approvedToday: approvedSubmissions.filter(
        (submission) => submission.submission_date === today,
      ).length,
      bestStreak: getBestStreak(approvedDates),
      currentStreak: getCurrentStreak(approvedDates),
      displayName:
        viewerProfileId && member.profile_id !== viewerProfileId
          ? pair.pair_members
              .find((pairMember) => pairMember.profile_id === viewerProfileId)
              ?.partner_nickname?.trim() ||
            getProfileLabel(member.profiles, index === 0 ? 'Pierwsza osoba' : 'Druga osoba')
          : getProfileLabel(member.profiles, index === 0 ? 'Pierwsza osoba' : 'Druga osoba'),
      earnedPoints,
      profileId: member.profile_id,
      redeemedRewards,
    }
  })
}

export default function MemberHistoryPage() {
  const router = useRouter()
  const { profile, status, supabase } = useAppContext()
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchMemberHistory>> | null>(
    null,
  )
  const [pair, setPair] = useState<PairWithMembers | null>(null)
  const [pairStats, setPairStats] = useState<PairStatsData | null>(null)
  const [photoUrls, setPhotoUrls] = useState<PhotoMap>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

      if (!activePair) {
        setPair(null)
        setPairStats(null)
        setHistory({ submissions: [], transactions: [], redemptions: [] })
        setError(null)
        return
      }

      setPair(activePair)

      const [nextHistory, nextPairStats] = await Promise.all([
        fetchMemberHistory(supabase, profile.id, activePair.id),
        fetchPairStats(supabase, activePair.id),
      ])

      setHistory(nextHistory)
      setPairStats(nextPairStats)
      setError(null)

      const paths =
        nextHistory.submissions.flatMap((submission) =>
          (submission.submission_photos ?? []).map((photo) => photo.storage_path),
        ) ?? []

      if (paths.length > 0) {
        const signed = await supabase.storage.from('task-photos').createSignedUrls(paths, 60 * 60)

        if (signed.error) {
          throw signed.error
        }

        const mappedUrls = signed.data.reduce<PhotoMap>((accumulator, item, index) => {
          const path = paths[index]
          if (item.signedUrl) {
            accumulator[path] = item.signedUrl
          }
          return accumulator
        }, {})

        setPhotoUrls(mappedUrls)
      } else {
        setPhotoUrls({})
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Nie udało się pobrać historii.',
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

  if (isLoading) {
    return status === 'ready' ? (
      <MemberLoadingScreen label="Ładowanie historii..." />
    ) : (
      <LoadingScreen label="Ładowanie historii..." />
    )
  }

  const stats = buildStats(pair, pairStats, profile?.id ?? null)

  return (
    <div className="app-shell px-4 pb-32 pt-5">
      <main className="section-stack">
        <section className="space-y-2 px-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
            Historia
          </p>
          <h1 className="text-3xl font-black text-[#422c36]">Streaki i aktywność</h1>
          <p className="text-sm leading-6 text-[#7f6870]">
            Wasze streaki, statystyki, ostatnie zgłoszenia, punkty i odebrane nagrody w jednym
            miejscu.
          </p>
        </section>

        {error ? <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{error}</Card> : null}

        <section className="section-stack">
          <Card className="space-y-4 bg-[linear-gradient(135deg,#fff7fb,#fff0df)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c65b84]">
                Streaki
              </p>
              <h2 className="text-xl font-black text-[#422c36]">Wasze tempo</h2>
              <p className="mt-1 text-sm text-[#7f6870]">
                Streak liczy kolejne dni z przynajmniej jednym zaakceptowanym zadaniem.
              </p>
            </div>

            {stats.length ? (
              <div className="grid gap-3">
                {stats.map((person) => (
                  <div className="rounded-[28px] bg-white/75 p-4 shadow-sm" key={person.profileId}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-[#422c36]">{person.displayName}</p>
                        <p className="text-sm text-[#7f6870]">
                          {person.approvedToday > 0
                            ? `Dzisiaj zaakceptowane: ${person.approvedToday}`
                            : 'Dzisiaj jeszcze bez zaakceptowanego zadania'}
                        </p>
                      </div>
                      <div className="rounded-full bg-[#ffe3ed] px-4 py-2 text-center text-[#ba396b]">
                        <p className="text-2xl font-black">{person.currentStreak}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em]">dni</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-3xl bg-[#fff8fb] p-3">
                        <p className="text-xs font-semibold text-[#9a7180]">Najlepszy streak</p>
                        <p className="text-xl font-black text-[#422c36]">{person.bestStreak} dni</p>
                      </div>
                      <div className="rounded-3xl bg-[#fff8fb] p-3">
                        <p className="text-xs font-semibold text-[#9a7180]">Ostatnie 7 dni</p>
                        <p className="text-xl font-black text-[#422c36]">
                          {person.approvedLast7Days}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-[#fff8fb] p-3">
                        <p className="text-xs font-semibold text-[#9a7180]">Ostatnie 30 dni</p>
                        <p className="text-xl font-black text-[#422c36]">
                          {person.approvedLast30Days}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-[#fff8fb] p-3">
                        <p className="text-xs font-semibold text-[#9a7180]">Zdobyte punkty</p>
                        <p className="text-xl font-black text-[#422c36]">
                          {formatPoints(person.earnedPoints)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-[#7f6870]">
                      Odebrane nagrody: <span className="font-bold">{person.redeemedRewards}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#7f6870]">
                Po połączeniu w parę pokażemy tutaj streaki obu osób.
              </p>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-[#422c36]">Zgłoszenia</h2>
            {history?.submissions.length ? (
              history.submissions.map((submission) => (
                <div className="space-y-3 rounded-3xl bg-[#fff8fb] p-4" key={submission.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#422c36]">
                        {submission.tasks?.title ?? 'Zadanie'}
                      </p>
                      <p className="text-sm text-[#7f6870]">
                        {formatDateKey(submission.submission_date)}
                      </p>
                    </div>
                    <StatusBadge status={submission.status} />
                  </div>

                  {submission.rejection_reason ? (
                    <p className="text-sm text-[#a2435f]">{submission.rejection_reason}</p>
                  ) : null}

                  {submission.submission_photos?.length ? (
                    <div className="grid grid-cols-3 gap-2">
                      {submission.submission_photos.map((photo) =>
                        photoUrls[photo.storage_path] ? (
                          /* biome-ignore lint/performance/noImgElement: signed Supabase URLs are shown directly in history cards. */
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
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7f6870]">Jeszcze nie ma żadnych zgłoszeń.</p>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-[#422c36]">Punkty</h2>
            {history?.transactions.length ? (
              history.transactions.map((transaction) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-3xl bg-[#fff8fb] p-4"
                  key={transaction.id}
                >
                  <div>
                    <p className="font-semibold text-[#422c36]">{transaction.note}</p>
                    <p className="text-sm text-[#7f6870]">{transaction.reason}</p>
                  </div>
                  <p
                    className={
                      transaction.amount >= 0
                        ? 'font-bold text-[#2f7a58]'
                        : 'font-bold text-[#b64968]'
                    }
                  >
                    {transaction.amount >= 0 ? '+' : ''}
                    {formatPoints(transaction.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7f6870]">Brak operacji punktowych.</p>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-[#422c36]">Nagrody</h2>
            {history?.redemptions.length ? (
              history.redemptions.map((redemption) => (
                <div className="rounded-3xl bg-[#fff8fb] p-4" key={redemption.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#422c36]">{redemption.reward_title}</p>
                      <p className="text-sm text-[#7f6870]">
                        {redemption.status === 'requested' ? 'Oczekuje' : 'Zrealizowana'}
                      </p>
                    </div>
                    <p className="font-bold text-[#b64968]">-{formatPoints(redemption.cost)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7f6870]">Nie odebrano jeszcze żadnych nagród.</p>
            )}
          </Card>
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
