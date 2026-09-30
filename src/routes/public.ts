import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { escapeHtml } from '../lib/html'
import { applyCoupon } from '../lib/coupons'
import { markOrderPaid } from '../lib/payments'
import { createPaymentLink, extractCallback, payplusEnabled, verifyCallback } from '../lib/payplus'
import { getSiteData } from '../lib/site'
import { isEmail, isObject, text } from '../lib/validate'

/** Mounted under /api. */
export const publicApi = new Hono<AppEnv>()
/** Mounted at the site root (public images and customer downloads). */
export const publicFiles = new Hono<AppEnv>()

// D1 hands BLOB columns back as an ArrayBuffer or, depending on runtime version, a plain number[].
const blob = (data: ArrayBuffer | number[]) => (Array.isArray(data) ? new Uint8Array(data) : data)

publicApi.get('/site', async (c) => c.json({ success: true, ...(await getSiteData(c.env.DB)) }))

const MAX_LINES = 20
const MAX_QTY = 10
const originOf = (c: { env: { SITE_URL?: string }; req: { url: string } }) => (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/+$/, '')
const round2 = (n: number) => Math.round(n * 100) / 100

type Line = { id: number; slug: string; name: string; price: number; paypal_url: string; quantity: number }

/** Resolves cart items (slug + quantity) against the database. Prices always come from D1. */
async function priceCart(db: D1Database, rawItems: unknown[]): Promise<{ lines: Line[]; subtotal: number } | { error: string; status: 400 | 409 }> {
  const wanted = new Map<string, number>()
  for (const it of rawItems.slice(0, MAX_LINES)) {
    if (!isObject(it)) continue
    const slug = text(it.id, 60)
    const qty = Math.floor(Number(it.quantity))
    if (slug && qty > 0) wanted.set(slug, Math.min(MAX_QTY, (wanted.get(slug) ?? 0) + qty))
  }
  if (wanted.size === 0) return { error: 'העגלה ריקה', status: 400 }
  const slugs = [...wanted.keys()]
  const { results } = await db
    .prepare(`SELECT id, slug, name, price, paypal_url FROM products WHERE active = 1 AND slug IN (${slugs.map(() => '?').join(',')})`)
    .bind(...slugs)
    .all<Omit<Line, 'quantity'>>()
  if (results.length !== slugs.length) return { error: 'חלק מהמוצרים אינם זמינים עוד', status: 409 }
  const lines = results.map((p) => ({ ...p, quantity: wanted.get(p.slug)! }))
  return { lines, subtotal: round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0)) }
}

/** Live preview of a coupon for the checkout page. */
publicApi.post('/coupon', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body) || !Array.isArray(body.items)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const cart = await priceCart(c.env.DB, body.items)
  if ('error' in cart) return c.json({ success: false, error: cart.error }, cart.status)
  const r = await applyCoupon(c.env.DB, body.code, cart.subtotal)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, code: r.code, discount: r.discount, total: round2(cart.subtotal - r.discount) })
})

/**
 * Creates a pending order and, when PayPlus is configured, a hosted payment page for it.
 * Totals and discounts are computed here from D1 — the browser only names products and a coupon code.
 */
publicApi.post('/orders', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body) || !isObject(body.customer) || !Array.isArray(body.items)) {
    return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  }
  const name = text(body.customer.name, 120)
  const email = text(body.customer.email, 200).toLowerCase()
  const phone = text(body.customer.phone, 30)
  if (!name) return c.json({ success: false, error: 'נא למלא שם מלא' }, 400)
  if (!isEmail(email)) return c.json({ success: false, error: 'כתובת אימייל לא תקינה' }, 400)

  const db = c.env.DB
  const cart = await priceCart(db, body.items)
  if ('error' in cart) return c.json({ success: false, error: cart.error }, cart.status)
  const { lines, subtotal } = cart

  let couponCode: string | null = null
  let discount = 0
  if (typeof body.coupon === 'string' && body.coupon.trim()) {
    const r = await applyCoupon(db, body.coupon, subtotal)
    if (!r.ok) return c.json({ success: false, error: r.error }, 400)
    couponCode = r.code
    discount = r.discount
  }
  const total = round2(subtotal - discount)
  const online = payplusEnabled(c.env)
  const orderRef = crypto.randomUUID()

  await db
    .prepare(
      `INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = COALESCE(NULLIF(excluded.phone, ''), customers.phone)`
    )
    .bind(name, email, phone)
    .run()
  const customer = await db.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<{ id: number }>()

  const order = await db
    .prepare(`INSERT INTO orders (customer_id, total_amount, status, order_ref, payment_provider, coupon_code, discount_amount) VALUES (?, ?, 'pending', ?, ?, ?, ?)`)
    .bind(customer!.id, total, orderRef, online ? 'payplus' : 'manual', couponCode, discount)
    .run()
  const orderId = order.meta.last_row_id
  await db.batch(
    lines.map((l) =>
      db
        .prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)')
        .bind(orderId, l.id, l.name, l.quantity, l.price)
    )
  )

  let approveUrl: string | null = null
  if (online) {
    try {
      // With a discount the itemised lines would not add up to the charged amount, so send one line for the order.
      const items = discount > 0
        ? [{ name: `הזמנה #${orderId} (כולל הנחה)`, quantity: 1, price: total }]
        : lines.map((l) => ({ name: l.name, quantity: l.quantity, price: l.price }))
      approveUrl = await createPaymentLink(c.env, { orderRef, amount: total, items, customer: { name, email, phone }, origin: originOf(c) })
    } catch (e) {
      console.error(e)
      await db.prepare("UPDATE orders SET status = 'cancelled', notes = 'שגיאה ביצירת דף התשלום' WHERE id = ?").bind(orderId).run()
      return c.json({ success: false, error: 'תקלה זמנית בפתיחת דף התשלום. נסי שוב בעוד רגע.' }, 502)
    }
  }

  return c.json({
    success: true,
    order: {
      id: orderId,
      ref: orderRef,
      total,
      discount,
      couponCode,
      approveUrl,
      items: lines.map((l) => ({ name: l.name, price: l.price, quantity: l.quantity, paypalUrl: online ? '' : l.paypal_url }))
    }
  })
})

/** PayPlus server-to-server callback. Authenticated by HMAC; idempotent; fails closed on anything unexpected. */
publicApi.post('/payplus/callback', async (c) => {
  if (!payplusEnabled(c.env)) return c.json({ success: false }, 404)
  const raw = await c.req.text()
  if (!(await verifyCallback(c.env, raw, c.req.raw.headers))) return c.json({ success: false, error: 'unauthorized' }, 401)
  const info = extractCallback(JSON.parse(raw))
  if (!info) {
    console.error('PayPlus callback without order reference')
    return c.json({ success: true }) // acknowledged so PayPlus does not retry forever; nothing was marked paid
  }
  const order = await c.env.DB.prepare('SELECT id, status, total_amount FROM orders WHERE order_ref = ?').bind(info.ref).first<{ id: number; status: string; total_amount: number }>()
  if (!order) return c.json({ success: true })
  if (!info.approved) {
    await c.env.DB.prepare("UPDATE orders SET status = 'cancelled', notes = 'התשלום נכשל או בוטל ב-PayPlus' WHERE id = ? AND status = 'pending'").bind(order.id).run()
    return c.json({ success: true })
  }
  // Never trust an approval whose amount we cannot match to the order.
  if (info.amount === null || Math.abs(info.amount - order.total_amount) > 0.005 || !info.transactionUid) {
    console.error('PayPlus callback amount/uid mismatch for order', order.id, info)
    return c.json({ success: true })
  }
  await markOrderPaid(c.env, originOf(c), order.id, info.transactionUid)
  return c.json({ success: true })
})

/** Newsletter sign-up. Requires explicit consent; a repeat sign-up is answered kindly, not as an error. */
publicApi.post('/subscribe', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const email = text(body.email, 200).toLowerCase()
  const name = text(body.name, 120)
  if (!isEmail(email)) return c.json({ success: false, error: 'כתובת אימייל לא תקינה' }, 400)
  if (body.consent !== true) return c.json({ success: false, error: 'נא לאשר קבלת דיוור כדי להירשם' }, 400)
  const code = 'WELCOME15'
  const res = await c.env.DB.prepare('INSERT INTO subscribers (email, name, source, consent, discount_code) VALUES (?, ?, ?, 1, ?) ON CONFLICT(email) DO NOTHING')
    .bind(email, name, text(body.source, 40) || 'footer', code)
    .run()
  return c.json({ success: true, already: !res.meta.changes, code, message: res.meta.changes ? 'נרשמת בהצלחה 💚' : 'את כבר רשומה 💚' })
})

/** PayPlus sends the customer back here after paying. Confirms with our own DB, then hands over the download. */
publicFiles.get('/checkout/success', async (c) => {
  const o = await c.env.DB.prepare('SELECT status, download_token FROM orders WHERE order_ref = ?').bind(c.req.query('ref') ?? '').first<{ status: string; download_token: string | null }>()
  if (!o) return c.redirect('/?payment=failed', 302)
  if ((o.status === 'paid' || o.status === 'delivered') && o.download_token) return c.redirect(`/?paid=${encodeURIComponent(o.download_token)}`, 302)
  if (o.status === 'cancelled') return c.redirect('/?payment=failed', 302)
  // Payment not confirmed by the callback yet: wait a few seconds and re-check.
  const n = Math.min(Number(c.req.query('n')) || 0, 30)
  const ref = encodeURIComponent(c.req.query('ref') ?? '')
  return c.html(
    `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
${n < 30 ? `<meta http-equiv="refresh" content="3;url=/checkout/success?ref=${ref}&n=${n + 1}">` : ''}<title>מאשרים תשלום…</title><link rel="stylesheet" href="/static/store.css"></head>
<body><main><div class="wrap"><div class="success"><h1>${n < 30 ? 'מאשרים את התשלום…' : 'התשלום עדיין בעיבוד'}</h1>
<p>${n < 30 ? 'זה לוקח כמה שניות. אל תסגרי את הדף.' : 'אם חויבת, קישור ההורדה יגיע אלייך במייל בקרוב. אפשר גם לפנות אלינו עם מספר ההזמנה.'}</p></div></div></main></body></html>`
  )
})
publicFiles.get('/checkout/failure', async (c) => {
  await c.env.DB.prepare("UPDATE orders SET status = 'cancelled' WHERE order_ref = ? AND status = 'pending'").bind(c.req.query('ref') ?? '').run()
  return c.redirect('/?payment=failed', 302)
})

/** Public images uploaded from the back office. Ids are random, so responses can be cached forever. */
publicFiles.get('/media/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT mime, data FROM media WHERE id = ?').bind(c.req.param('id')).first<{ mime: string; data: ArrayBuffer | number[] }>()
  if (!row) return c.notFound()
  return new Response(blob(row.data), {
    headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }
  })
})

/**
 * Customer download page. The order's random token is the credential, and files
 * are only released once the order has been marked paid in the back office.
 */
async function paidOrder(db: D1Database, token: string) {
  return db.prepare("SELECT id FROM orders WHERE download_token = ? AND status IN ('paid','delivered')").bind(token).first<{ id: number }>()
}

/**
 * Delivery data per order line. The live product wins (so customers get updated files); if the
 * product was deleted, the snapshot stored on the order line is used.
 */
const DELIVERY_SQL = `SELECT oi.id AS item_id, oi.product_name,
    COALESCE(p.file_id, oi.file_id) AS file_id,
    COALESCE(NULLIF(p.file_url, ''), oi.file_url, '') AS file_url
  FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`

const page = (title: string, body: string) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/static/store.css"></head><body><main><div class="wrap"><div class="success">${body}</div></div></main></body></html>`

publicFiles.get('/download/:token', async (c) => {
  const order = await paidOrder(c.env.DB, c.req.param('token'))
  if (!order) return c.html(page('קישור לא תקין', '<h1>הקישור אינו תקף</h1><p>ההזמנה טרם אושרה או שהקישור שגוי.</p>'), 404)
  const { results } = await c.env.DB.prepare(DELIVERY_SQL).bind(order.id).all<{ item_id: number; product_name: string; file_id: string | null; file_url: string }>()
  const rows = results
    .filter((r) => r.file_id || r.file_url)
    .map((r) => `<div class="dl-row"><div class="dl-info"><h4>${escapeHtml(r.product_name)}</h4><a class="btn btn-primary btn-sm" href="/download/${escapeHtml(c.req.param('token'))}/${r.item_id}">הורדה</a></div></div>`)
    .join('')
  return c.html(page('ההורדות שלך', `<h1>ההורדות שלך</h1><div class="dl-list">${rows || '<p>הקבצים יתווספו בקרוב.</p>'}</div>`))
})

publicFiles.get('/download/:token/:itemId', async (c) => {
  const order = await paidOrder(c.env.DB, c.req.param('token'))
  if (!order) return c.notFound()
  const product = await c.env.DB.prepare(`${DELIVERY_SQL} AND oi.id = ?`)
    .bind(order.id, c.req.param('itemId'))
    .first<{ file_url: string; file_id: string | null }>()
  if (!product) return c.notFound()
  if (product.file_id) {
    const file = await c.env.DB.prepare('SELECT filename, mime, data FROM files WHERE id = ?').bind(product.file_id).first<{ filename: string; mime: string; data: ArrayBuffer | number[] }>()
    if (file) {
      return new Response(blob(file.data), {
        headers: {
          'Content-Type': file.mime,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    }
  }
  if (product.file_url) return c.redirect(product.file_url, 302)
  return c.notFound()
})

