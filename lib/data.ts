import type { SupabaseClient } from '@supabase/supabase-js'

import { getPointBalance } from '@/lib/points'
import type { Database, Tables } from '@/lib/supabase/types'

export type AppSupabaseClient = SupabaseClient<Database>

export type TodayTaskItem = Tables<'tasks'> & {
  latestSubmission:
    | (Tables<'task_submissions'> & {
        photos: Tables<'submission_photos'>[]
      })
    | null
}

export type PairWithMembers = Tables<'pairs'> & {
  pair_members: Array<Tables<'pair_members'> & { profiles: Tables<'profiles'> | null }>
}

export type PairRequestWithProfiles = Tables<'pair_requests'> & {
  recipient: Tables<'profiles'> | null
  requester: Tables<'profiles'> | null
}

export type PairStatsData = {
  redemptions: Tables<'reward_redemptions'>[]
  submissions: Array<
    Tables<'task_submissions'> & {
      tasks: Tables<'tasks'> | null
    }
  >
  transactions: Tables<'point_transactions'>[]
}

export async function resolveProfileForSession(supabase: AppSupabaseClient, authUserId: string) {
  const ownerEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  if (!ownerEmail) {
    throw new Error('Brakuje zmiennej środowiskowej NEXT_PUBLIC_ADMIN_EMAIL.')
  }

  const syncResponse = await supabase.rpc('sync_current_profile', {
    p_admin_email: ownerEmail,
  })

  if (syncResponse.error) {
    throw syncResponse.error
  }

  const profileResponse = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (profileResponse.error) {
    throw profileResponse.error
  }

  return profileResponse.data ?? null
}

export async function fetchTodayTasks(
  supabase: AppSupabaseClient,
  pairId: string,
  profileId: string,
  dateKey: string,
) {
  const [{ data: tasks, error: tasksError }, { data: submissions, error: submissionsError }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('pair_id', pairId)
        .eq('target_profile_id', profileId)
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('task_submissions')
        .select('*, submission_photos(*)')
        .eq('pair_id', pairId)
        .eq('profile_id', profileId)
        .eq('submission_date', dateKey)
        .order('created_at', { ascending: false }),
    ])

  if (tasksError) {
    throw tasksError
  }

  if (submissionsError) {
    throw submissionsError
  }

  const relevantTasks =
    tasks?.filter(
      (task) => task.type === 'daily' || (task.type === 'one_time' && task.date === dateKey),
    ) ?? []

  const latestSubmissionByTaskId = new Map<string, TodayTaskItem['latestSubmission']>()

  for (const submission of submissions ?? []) {
    if (latestSubmissionByTaskId.has(submission.task_id)) {
      continue
    }

    latestSubmissionByTaskId.set(submission.task_id, {
      ...submission,
      photos: submission.submission_photos ?? [],
    })
  }

  return relevantTasks.map((task) => ({
    ...task,
    latestSubmission: latestSubmissionByTaskId.get(task.id) ?? null,
  }))
}

export async function fetchPointTransactions(
  supabase: AppSupabaseClient,
  profileId: string,
  pairId?: string,
) {
  let query = supabase
    .from('point_transactions')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (pairId) {
    query = query.eq('pair_id', pairId)
  }

  const response = await query

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function fetchMemberBalance(
  supabase: AppSupabaseClient,
  profileId: string,
  pairId?: string,
) {
  const transactions = await fetchPointTransactions(supabase, profileId, pairId)

  return {
    balance: getPointBalance(transactions),
    transactions,
  }
}

export async function fetchRewards(supabase: AppSupabaseClient, pairId: string, profileId: string) {
  const response = await supabase
    .from('rewards')
    .select('*')
    .eq('pair_id', pairId)
    .eq('target_profile_id', profileId)
    .eq('active', true)
    .order('cost')

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function fetchMemberHistory(
  supabase: AppSupabaseClient,
  profileId: string,
  pairId: string,
) {
  const [submissionsResponse, transactionsResponse, redemptionsResponse] = await Promise.all([
    supabase
      .from('task_submissions')
      .select('*, tasks(*), submission_photos(*)')
      .eq('pair_id', pairId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('point_transactions')
      .select('*')
      .eq('pair_id', pairId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('reward_redemptions')
      .select('*')
      .eq('pair_id', pairId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  if (submissionsResponse.error) {
    throw submissionsResponse.error
  }

  if (transactionsResponse.error) {
    throw transactionsResponse.error
  }

  if (redemptionsResponse.error) {
    throw redemptionsResponse.error
  }

  return {
    submissions: submissionsResponse.data ?? [],
    transactions: transactionsResponse.data ?? [],
    redemptions: redemptionsResponse.data ?? [],
  }
}

export async function fetchPairStats(supabase: AppSupabaseClient, pairId: string) {
  const [submissionsResponse, transactionsResponse, redemptionsResponse] = await Promise.all([
    supabase
      .from('task_submissions')
      .select('*, tasks(*)')
      .eq('pair_id', pairId)
      .order('submission_date', { ascending: false })
      .limit(500),
    supabase
      .from('point_transactions')
      .select('*')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('reward_redemptions')
      .select('*')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (submissionsResponse.error) {
    throw submissionsResponse.error
  }

  if (transactionsResponse.error) {
    throw transactionsResponse.error
  }

  if (redemptionsResponse.error) {
    throw redemptionsResponse.error
  }

  return {
    redemptions: redemptionsResponse.data ?? [],
    submissions: submissionsResponse.data ?? [],
    transactions: transactionsResponse.data ?? [],
  } satisfies PairStatsData
}

export async function fetchPairSubmissions(supabase: AppSupabaseClient, pairId: string) {
  const response = await supabase
    .from('task_submissions')
    .select(
      '*, tasks(*), member_profile:profiles!task_submissions_profile_id_fkey(*), submission_photos(*)',
    )
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []).sort((a, b) => {
    if (a.status === b.status) {
      return a.created_at < b.created_at ? 1 : -1
    }

    if (a.status === 'pending') {
      return -1
    }

    if (b.status === 'pending') {
      return 1
    }

    return a.created_at < b.created_at ? 1 : -1
  })
}

export async function fetchPairTasks(
  supabase: AppSupabaseClient,
  pairId: string,
  createdByProfileId: string,
) {
  const response = await supabase
    .from('tasks')
    .select('*')
    .eq('pair_id', pairId)
    .eq('created_by_profile_id', createdByProfileId)
    .order('created_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function fetchPairRewards(
  supabase: AppSupabaseClient,
  pairId: string,
  createdByProfileId: string,
) {
  const [rewardsResponse, redemptionsResponse] = await Promise.all([
    supabase
      .from('rewards')
      .select('*')
      .eq('pair_id', pairId)
      .eq('created_by_profile_id', createdByProfileId)
      .order('cost'),
    supabase
      .from('reward_redemptions')
      .select('*, profiles(*)')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (rewardsResponse.error) {
    throw rewardsResponse.error
  }

  if (redemptionsResponse.error) {
    throw redemptionsResponse.error
  }

  return {
    rewards: rewardsResponse.data ?? [],
    redemptions: redemptionsResponse.data ?? [],
  }
}

export async function fetchAllowedUsers(supabase: AppSupabaseClient) {
  const response = await supabase
    .from('allowed_users')
    .select('*')
    .order('role', { ascending: true })
    .order('email', { ascending: true })

  if (response.error) {
    throw response.error
  }

  return response.data ?? []
}

export async function fetchPairRequests(supabase: AppSupabaseClient, profileId: string) {
  const response = await supabase
    .from('pair_requests')
    .select(
      '*, requester:profiles!pair_requests_requester_profile_id_fkey(*), recipient:profiles!pair_requests_recipient_profile_id_fkey(*)',
    )
    .or(`requester_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []) as PairRequestWithProfiles[]
}

export async function fetchMyPairs(supabase: AppSupabaseClient, profileId: string) {
  const membershipsResponse = await supabase
    .from('pair_members')
    .select('pair_id')
    .eq('profile_id', profileId)

  if (membershipsResponse.error) {
    throw membershipsResponse.error
  }

  const pairIds = (membershipsResponse.data ?? []).map((membership) => membership.pair_id)

  if (pairIds.length === 0) {
    return []
  }

  const response = await supabase
    .from('pairs')
    .select('*, pair_members(*, profiles(*))')
    .in('id', pairIds)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (response.error) {
    throw response.error
  }

  return (response.data ?? []) as PairWithMembers[]
}
