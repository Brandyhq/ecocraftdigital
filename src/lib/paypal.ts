import type { Bindings } from '../env'
import { randomToken } from './crypto'

const CURRENCY = 'ILS'

export const paypalEnabled = (env: Bindings) => !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET)

const apiBase = (env: Bindings) => env.PAYPAL_API_BASE ?? (env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

let cachedToken: { key: string; token: string; exp: number } | null = null

async function accessToken(env: Bindings): Promise<string> {
  const key = `${apiBase(env)}|${env.PAYPAL_CLIENT_ID}`
  if (cachedToken && cachedToken.key === key && cachedToken.exp > Date.now() + 60_000) return cachedToken.token
  const res = await fetch(`${apiBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  })
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { key, token: data.access_token, exp: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

async function call<T>(env: Bindings, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(apiBase(env) + path, {
    method,
    headers: { Authorization: `Bearer ${await accessToken(env)}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T }
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

export type PayPalOrder = {
  id: string
  status: string
  purchase_units?: { custom_id?: string; amount?: { currency_code: string; value: string }; payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] } }[]
  links?: { rel: string; href: string }[]
}

/** Creates a PayPal order for one of our orders and returns the URL the customer must approve it at. */
export async function createPayPalOrder(
  env: Bindings,
  order: { id: number; total: number; items: { name: string; price: number; quantity: number }[] },
  origin: string,
  brand: string
) {
  const { status, data } = await call<PayPalOrder>(
    env,
    'POST',
    '/v2/checkout/orders',
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: String(order.id),
          custom_id: String(order.id),
          description: `${brand} #${order.id}`.slice(0, 127),
          amount: {
            currency_code: CURRENCY,
            value: money(order.total),
            breakdown: { item_total: { currency_code: CURRENCY, value: money(order.total) } }
          },
          items: order.items.map((i) => ({
            name: i.name.slice(0, 127),
            quantity: String(i.quantity),
            unit_amount: { currency_code: CURRENCY, value: money(i.price) },
            category: 'DIGITAL_GOODS'
          }))
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: brand.slice(0, 127),
            locale: 'he-IL',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${origin}/paypal/return`,
            cancel_url: `${origin}/paypal/cancel`
          }
        }
      }
    },
    { 'PayPal-Request-Id': `order-${order.id}-${randomToken(6)}` }
  )
  const approve = data.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href
  if (status >= 300 || !data.id || !approve) throw new Error(`PayPal create order failed (${status})`)
  return { paypalOrderId: data.id, approveUrl: approve }
}

/**
 * Settles a PayPal order: asks PayPal (the source of truth) for its state, captures it if the
 * customer approved, and — only if the captured amount matches our order — marks our order paid.
 * Safe to call repeatedly and from untrusted triggers (return URL, webhook).
 */
export async function settlePayPalOrder(env: Bindings, paypalOrderId: string): Promise<'paid' | 'pending' | 'failed' | 'unknown'> {
  const db = env.DB
  const ours = await db.prepare('SELECT id, status, total_amount FROM orders WHERE paypal_order_id = ?').bind(paypalOrderId).first<{ id: number; status: string; total_amount: number }>()
  if (!ours) return 'unknown'
  if (ours.status === 'paid' || ours.status === 'delivered') return 'paid'

  let { data: pp } = await call<PayPalOrder>(env, 'GET', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`)
  if (pp.status === 'APPROVED') {
    const captured = await call<PayPalOrder>(env, 'POST', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, undefined, {
      'PayPal-Request-Id': `capture-${paypalOrderId}`
    })
    pp = captured.status < 300 ? captured.data : (await call<PayPalOrder>(env, 'GET', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`)).data
  }
  if (pp.status !== 'COMPLETED') return pp.status === 'VOIDED' ? 'failed' : 'pending'

  const unit = pp.purchase_units?.[0]
  const capture = unit?.payments?.captures?.[0]
  const valid =
    capture?.status === 'COMPLETED' &&
    capture.amount.currency_code === CURRENCY &&
    capture.amount.value === money(ours.total_amount) &&
    unit?.custom_id === String(ours.id)
  if (!valid) {
    console.error('PayPal capture mismatch for order', ours.id, JSON.stringify(unit))
    return 'failed'
  }
  await db
    .prepare(
      `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), paypal_capture_id = ?,
         download_token = COALESCE(download_token, ?), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending','cancelled')`
    )
    .bind(capture!.id, randomToken(24), ours.id)
    .run()
  return 'paid'
}

/** Verifies a webhook call with PayPal. Only used when PAYPAL_WEBHOOK_ID is configured. */
export async function verifyWebhook(env: Bindings, headers: Headers, event: unknown): Promise<boolean> {
  const { status, data } = await call<{ verification_status?: string }>(env, 'POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event
  })
  return status < 300 && data.verification_status === 'SUCCESS'
}
