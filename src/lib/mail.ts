import type { Bindings } from '../env'

/** Sends an email through Resend when configured; silently does nothing otherwise. Returns true if sent. */
export async function sendMail(env: Bindings, o: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [o.to], subject: o.subject, html: o.html })
    })
    if (!res.ok) console.error('Resend failed', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (e) {
    console.error('Resend error', e)
    return false
  }
}
