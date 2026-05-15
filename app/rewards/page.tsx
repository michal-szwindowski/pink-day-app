'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, useTransition } from 'react'

import { BalanceCard } from '@/components/balance-card'
import { BottomNav } from '@/components/bottom-nav'
import { LoadingScreen } from '@/components/loading-screen'
import { MemberLoadingScreen } from '@/components/member-loading-screen'
import { useAppContext } from '@/components/providers/app-provider'
import { useToast } from '@/components/providers/toast-provider'
import { RewardCard } from '@/components/reward-card'
import { Card } from '@/components/ui/card'
import { useAutoRefresh } from '@/components/use-auto-refresh'
import { fetchMemberBalance, fetchMyPairs, fetchRewards } from '@/lib/data'
import { sendPushNotification } from '@/lib/push'
import type { Tables } from '@/lib/supabase/types'

export default function MemberRewardsPage() {
  const router = useRouter()
  const { profile, status, supabase } = useAppContext()
  const { showToast } = useToast()
  const [balance, setBalance] = useState(0)
  const [rewards, setRewards] = useState<Tables<'rewards'>[]>([])
  const [pairId, setPairId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

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
        setPairId(null)
        setRewards([])
        setBalance(0)
        return
      }

      setPairId(activePair.id)

      const [balanceState, rewardsList] = await Promise.all([
        fetchMemberBalance(supabase, profile.id, activePair.id),
        fetchRewards(supabase, activePair.id, profile.id),
      ])

      setBalance(balanceState.balance)
      setRewards(rewardsList)
      setLoadError(null)
    } catch (caughtError) {
      setLoadError(
        caughtError instanceof Error ? caughtError.message : 'Nie udało się pobrać nagród.',
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
      <MemberLoadingScreen label="Ładowanie nagród..." />
    ) : (
      <LoadingScreen label="Ładowanie nagród..." />
    )
  }

  return (
    <div className="app-shell px-4 pb-32 pt-5">
      <main className="section-stack">
        <section className="space-y-2 px-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c65b84]">
            Nagrody
          </p>
          <h1 className="text-3xl font-black text-[#422c36]">Wymień punkty na coś miłego</h1>
          <p className="text-sm leading-6 text-[#7f6870]">
            Gdy klikniesz odbiór, punkty zejdą od razu, a prośba zostanie zapisana w Waszej parze.
          </p>
        </section>

        <BalanceCard balance={balance} />

        {loadError ? (
          <Card className="bg-[#fff1f4] text-sm text-[#a2435f]">{loadError}</Card>
        ) : null}

        <section className="section-stack">
          {rewards.length > 0 ? (
            rewards.map((reward) => (
              <RewardCard
                balance={balance}
                key={reward.id}
                onRedeem={(currentReward) => {
                  startTransition(async () => {
                    if (!profile || !pairId) {
                      return
                    }

                    if (balance < currentReward.cost) {
                      showToast('Masz za mało punktów na tę nagrodę.', 'error')
                      return
                    }

                    try {
                      const response = await supabase.rpc('request_reward_redemption', {
                        p_pair_id: pairId,
                        p_profile_id: profile.id,
                        p_reward_id: currentReward.id,
                      })

                      if (response.error) {
                        throw response.error
                      }

                      showToast('Nagroda została zamówiona.', 'success')
                      if (
                        currentReward.created_by_profile_id &&
                        currentReward.created_by_profile_id !== profile.id
                      ) {
                        await sendPushNotification(supabase, {
                          body: `${profile.display_name ?? 'Ktoś'} odebrał(a): ${currentReward.title}`,
                          recipientProfileIds: [currentReward.created_by_profile_id],
                          title: 'Odbiór nagrody',
                          url: '/pair',
                        })
                      }
                      await loadData()
                    } catch (caughtError) {
                      showToast(
                        caughtError instanceof Error
                          ? caughtError.message
                          : 'Nie udało się odebrać nagrody.',
                        'error',
                      )
                    }
                  })
                }}
                reward={reward}
              />
            ))
          ) : (
            <Card className="text-center text-sm text-[#7f6870]">
              Nie ma jeszcze żadnych aktywnych nagród.
            </Card>
          )}
        </section>

        {isPending ? <p className="px-2 text-sm text-[#8b6f79]">Zapisywanie zmian...</p> : null}
      </main>
      <BottomNav />
    </div>
  )
}
