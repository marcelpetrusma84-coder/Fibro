import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const { receiver_id, title, body, url } = await req.json()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', receiver_id)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: false, reden: 'Geen subscription' }), { status: 200 })
  }

  const payload = JSON.stringify({ title, body, url: url || '/chat.html' })

  for (const sub of subs) {
    await sendPush(sub.subscription, payload)
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})

async function sendPush(subscription: any, payload: string) {
  const { endpoint, keys } = subscription
  const { p256dh, auth } = keys

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: payload,
  })

  return response
}
