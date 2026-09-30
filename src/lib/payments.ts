import type { Bindings } from '../env'
import { randomToken } from './crypto'
import { escapeHtml } from './html'
import { sendMail } from './mail'

/**
 * Marks an order paid exactly once (idempotent), creates its personal download token, counts the coupon
 * use, and emails the download link when a mail service is configured. Returns false if it was already paid.
 */
export async function markOrderPaid(env: Bindings, origin: string, orderId: number, transactionUid: string | null): Promise<boolean> {
  const db = env.DB
  const res = await db
    .prepare(
      `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
         payplus_transaction_uid = COALESCE(?, payplus_transaction_uid),
         download_token = COALESCE(download_token, ?), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending', 'cancelled')`
    )
    .bind(transactionUid, randomToken(24), orderId)
    .run()
  if (!res.meta.changes) return false

  await db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = (SELECT coupon_code FROM orders WHERE id = ?)').bind(orderId).run()

  const o = await db
    .prepare('SELECT o.download_token, cu.name, cu.email FROM orders o JOIN customers cu ON cu.id = o.customer_id WHERE o.id = ?')
    .bind(orderId)
    .first<{ download_token: string; name: string; email: string }>()
  if (o) {
    const link = `${origin}/download/${o.download_token}`
    const sent = await sendMail(env, {
      to: o.email,
      subject: 'ההזמנה שלך מ-EcoCraft Digital — קישור להורדה',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><p>שלום ${escapeHtml(o.name)},</p><p>תודה על הרכישה! הקבצים שלך מוכנים להורדה בקישור האישי:</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p>אם משהו לא עובד, פשוט השיבי למייל הזה.</p></div>`
    })
    if (sent) await db.prepare("UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'paid'").bind(orderId).run()
  }
  return true
}
