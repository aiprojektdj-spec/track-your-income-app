import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PADDLE_WEBHOOK_SECRET  = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const body      = await req.text()
  const signature = req.headers.get('paddle-signature') ?? ''

  // ── HMAC-Signatur prüfen ──────────────────────────────────────
  if (!PADDLE_WEBHOOK_SECRET) {
    return new Response('Webhook secret not configured', { status: 500 })
  }
  if (!signature) {
    return new Response('Missing signature', { status: 401 })
  }

  const parts = Object.fromEntries(signature.split(';').map(p => p.split('=')))
  const ts = parts['ts']
  const h1 = parts['h1']
  if (!ts || !h1) return new Response('Invalid signature', { status: 401 })

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PADDLE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${ts}:${body}`)
  )
  const expected = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  if (expected !== h1) return new Response('Invalid signature', { status: 401 })

  // ── UUID-Validierung userId ───────────────────────────────────
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const event     = JSON.parse(body)
  const eventType = event.event_type as string
  const data      = event.data

  // Nur Subscription-Events verarbeiten
  if (!eventType?.startsWith('subscription.')) {
    return new Response('OK', { status: 200 })
  }

  const userId = data?.custom_data?.user_id
  if (!userId) return new Response('No user_id in custom_data', { status: 200 })
  if (!uuidRegex.test(userId)) return new Response('Invalid user_id format', { status: 400 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const status           = data.status
  const currentPeriodEnd = data.current_billing_period?.ends_at ?? null
  const subscriptionId   = data.id
  const customerId       = data.customer_id

  await supabase.from('subscriptions').upsert({
    user_id:                  userId,
    plan:                     'pro',
    status:                   status,
    current_period_end:       currentPeriodEnd,
    paddle_subscription_id:   subscriptionId,
    paddle_customer_id:       customerId,
    updated_at:               new Date().toISOString()
  }, { onConflict: 'user_id' })

  return new Response('OK', { status: 200 })
})
