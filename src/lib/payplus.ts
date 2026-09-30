import type { Bindings } from '../env'
import { timingSafeEqual, toB64 } from './crypto'

export const payplusEnabled = (env: Bindings) => !!(env.PAYPLUS_API_KEY && env.PAYPLUS_SECRET_KEY && env.PAYPLUS_PAGE_UID)

const apiBase = (env: Bindings) =>
  env.PAYPLUS_API_BASE ?? (env.PAYPLUS_ENV === 'production' ? 'https://restapi.payplus.co.il/api/v1.0' : 'https://restapidev.payplus.co.il/api/v1.0')

type LinkResponse = { results?: { status?: string; description?: string }; data?: { payment_page_link?: string; page_request_uid?: string } }

/** Creates a hosted PayPlus payment page (cards + Bit, whatever is enabled on the page) for one order. */
export async function createPaymentLink(
  env: Bindings,
  o: {
    orderRef: string
    amount: number
    items: { name: string; quantity: number; price: number }[]
    customer: { name: string; email: string; phone: string }
    origin: string
  }
): Promise<string> {
  const res = await fetch(`${apiBase(env)}/PaymentPages/generateLink`, {
    method: 'POST',
    headers: { 'api-key': env.PAYPLUS_API_KEY!, 'secret-key': env.PAYPLUS_SECRET_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_page_uid: env.PAYPLUS_PAGE_UID,
      amount: o.amount,
      currency_code: 'ILS',
      charge_method: 1, // immediate charge
      items: o.items,
      refURL_success: `${o.origin}/checkout/success?ref=${o.orderRef}`,
      refURL_failure: `${o.origin}/checkout/failure?ref=${o.orderRef}`,
      refURL_callback: `${o.origin}/api/payplus/callback`,
      more_info: o.orderRef,
      send_failure_callback: true,
      ...(env.PAYPLUS_INVOICES === 'true' ? { initial_invoice: true } : {}),
      customer: { customer_name: o.customer.name, email: o.customer.email, phone: o.customer.phone }
    })
  })
  const data = (await res.json().catch(() => ({}))) as LinkResponse
  const link = data.data?.payment_page_link
  if (!res.ok || !link) throw new Error(`PayPlus generateLink failed (${res.status}): ${data.results?.description ?? ''}`)
  return link
}

const enc = new TextEncoder()

async function hmacBase64(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toB64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))))
}

/**
 * PayPlus callback authenticity: user-agent must be "PayPlus" and the `hash` header must equal
 * base64(HMAC-SHA256(secret_key, JSON body)). We accept the raw body as received, or its re-serialised
 * form (PayPlus documents JSON.stringify(body)), and compare in constant time.
 */
export async function verifyCallback(env: Bindings, rawBody: string, headers: Headers): Promise<boolean> {
  if (headers.get('user-agent') !== 'PayPlus') return false
  const hash = headers.get('hash')
  if (!hash || !env.PAYPLUS_SECRET_KEY) return false
  const candidates = [rawBody]
  try {
    candidates.push(JSON.stringify(JSON.parse(rawBody)))
  } catch {
    return false
  }
  for (const c of candidates) {
    if (timingSafeEqual(enc.encode(await hmacBase64(env.PAYPLUS_SECRET_KEY, c)), enc.encode(hash))) return true
  }
  return false
}

export type CallbackInfo = { ref: string; transactionUid: string; approved: boolean; amount: number | null }

/**
 * Pulls the fields we need out of a (verified) callback. Field names follow PayPlus' IPN shape
 * (`transaction.{uid,status_code,amount,more_info}`) with fallbacks to the top level. Returns null when
 * the order reference cannot be found — the caller must then NOT mark anything paid.
 */
export function extractCallback(body: unknown): CallbackInfo | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = (typeof b.transaction === 'object' && b.transaction) || b
  const ref = t.more_info ?? b.more_info ?? b.data?.more_info
  if (typeof ref !== 'string' || !ref) return null
  const code = String(t.status_code ?? b.status_code ?? '')
  const status = String(t.status ?? b.status ?? '').toLowerCase()
  const amount = Number(t.amount ?? b.amount)
  return {
    ref,
    transactionUid: String(t.uid ?? t.transaction_uid ?? b.transaction_uid ?? ''),
    approved: code === '000' || status === 'approved' || status === 'success',
    amount: Number.isFinite(amount) ? amount : null
  }
}
