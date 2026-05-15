import { NextResponse } from 'next/server'
import webPush, { type PushSubscription } from 'web-push'

import { getSupabaseAuthClient, getSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PushRequestBody = {
  body?: string
  recipientProfileIds?: string[]
  title?: string
  url?: string
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice('bearer '.length).trim()
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

  if (!publicKey || !privateKey) {
    return false
  }

  webPush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function POST(request: Request) {
  if (!configureWebPush()) {
    return NextResponse.json({ error: 'Push nie ma ustawionych kluczy VAPID.' }, { status: 503 })
  }

  const token = getBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Brak sesji.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as PushRequestBody | null
  const recipientProfileIds = [...new Set(body?.recipientProfileIds ?? [])].slice(0, 5)

  if (!body?.title || !body.body || recipientProfileIds.length === 0) {
    return NextResponse.json({ error: 'Brakuje danych powiadomienia.' }, { status: 400 })
  }

  const authClient = getSupabaseAuthClient(token)
  const serviceClient = getSupabaseServiceClient()
  const userResponse = await authClient.auth.getUser()

  if (userResponse.error || !userResponse.data.user) {
    return NextResponse.json({ error: 'Sesja wygasła.' }, { status: 401 })
  }

  const profileResponse = await serviceClient
    .from('profiles')
    .select('*')
    .eq('auth_user_id', userResponse.data.user.id)
    .eq('active', true)
    .maybeSingle()

  if (profileResponse.error || !profileResponse.data) {
    return NextResponse.json({ error: 'Nie znaleziono profilu.' }, { status: 403 })
  }

  const senderProfileId = profileResponse.data.id
  const membershipsResponse = await serviceClient
    .from('pair_members')
    .select('pair_id')
    .eq('profile_id', senderProfileId)

  if (membershipsResponse.error) {
    return NextResponse.json({ error: membershipsResponse.error.message }, { status: 500 })
  }

  const pairIds = (membershipsResponse.data ?? []).map((membership) => membership.pair_id)
  const allowedRecipientIds = new Set<string>()

  if (pairIds.length > 0) {
    const pairMembersResponse = await serviceClient
      .from('pair_members')
      .select('profile_id')
      .in('pair_id', pairIds)
      .in('profile_id', recipientProfileIds)

    if (pairMembersResponse.error) {
      return NextResponse.json({ error: pairMembersResponse.error.message }, { status: 500 })
    }

    for (const member of pairMembersResponse.data ?? []) {
      if (member.profile_id !== senderProfileId) {
        allowedRecipientIds.add(member.profile_id)
      }
    }
  }

  const allowedRecipients = recipientProfileIds.filter((profileId) =>
    allowedRecipientIds.has(profileId),
  )

  if (allowedRecipients.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const subscriptionsResponse = await serviceClient
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .in('profile_id', allowedRecipients)

  if (subscriptionsResponse.error) {
    return NextResponse.json({ error: subscriptionsResponse.error.message }, { status: 500 })
  }

  const payload = JSON.stringify({
    body: body.body,
    title: body.title,
    url: body.url ?? '/',
  })
  let sent = 0

  await Promise.all(
    (subscriptionsResponse.data ?? []).map(async (subscriptionRow) => {
      try {
        await webPush.sendNotification(
          subscriptionRow.subscription as unknown as PushSubscription,
          payload,
        )
        sent += 1
      } catch (caughtError) {
        if (
          caughtError &&
          typeof caughtError === 'object' &&
          'statusCode' in caughtError &&
          (caughtError.statusCode === 404 || caughtError.statusCode === 410)
        ) {
          await serviceClient.from('push_subscriptions').delete().eq('id', subscriptionRow.id)
        }
      }
    }),
  )

  return NextResponse.json({ sent })
}
