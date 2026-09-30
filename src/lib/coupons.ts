export type CouponResult = { ok: true; code: string; discount: number } | { ok: false; error: string }

/**
 * Validates a coupon on the server and computes the discount. Never trusts the browser:
 * active, not expired, not used up. The result is capped so the payable total stays at least ₪1.
 */
export async function applyCoupon(db: D1Database, raw: unknown, subtotal: number): Promise<CouponResult> {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase().slice(0, 40) : ''
  if (!code) return { ok: false, error: 'נא להזין קוד הנחה' }
  const c = await db
    .prepare('SELECT code, type, value, active, max_uses, used_count, expires_at FROM coupons WHERE code = ?')
    .bind(code)
    .first<{ code: string; type: string; value: number; active: number; max_uses: number | null; used_count: number; expires_at: string | null }>()
  if (!c || !c.active) return { ok: false, error: 'קוד ההנחה אינו תקף' }
  if (c.expires_at && new Date(c.expires_at.replace(' ', 'T') + (c.expires_at.includes('Z') ? '' : 'Z')) < new Date()) return { ok: false, error: 'תוקף קוד ההנחה פג' }
  if (c.max_uses !== null && c.used_count >= c.max_uses) return { ok: false, error: 'קוד ההנחה כבר נוצל' }
  let discount = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value
  discount = Math.round(Math.min(discount, Math.max(0, subtotal - 1)) * 100) / 100
  if (discount <= 0) return { ok: false, error: 'קוד ההנחה אינו חל על הסל הזה' }
  return { ok: true, code: c.code, discount }
}
