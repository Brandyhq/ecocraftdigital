import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { escapeHtml } from '../lib/html'
import { createPayPalOrder, paypalEnabled, settlePayPalOrder, verifyWebhook } from '../lib/paypal'
import { getSiteData } from '../lib/site'
import { isEmail, isObject, text } from '../lib/validate'

/** Mounted under /api. */
export const publicApi = new Hono<AppEnv>()
/** Mounted at the site root (public images and customer downloads). */
export const publicFiles = new Hono<AppEnv>()

// D1 hands BLOB columns back as an ArrayBuffer or, depending on runtime version, a plain number[].
const blob = (data: ArrayBuffer | number[]) => (Array.isArray(data) ? new Uint8Array(data) : data)

publicApi.get('/site', async (c) => c.json({ success: true, ...(await getSiteData(c.env.DB)) }))

/** PayPal server-to-server notifications. Handling is idempotent and re-checks state with PayPal itself. */
publicApi.post('/paypal/webhook', async (c) => {
  if (!paypalEnabled(c.env)) return c.json({ success: false }, 404)
  const event = await c.req.json().catch(() => null)
  if (!isObject(event)) return c.json({ success: false }, 400)
  if (c.env.PAYPAL_WEBHOOK_ID && !(await verifyWebhook(c.env, c.req.raw.headers, event))) return c.json({ success: false }, 401)
  const resource = isObject(event.resource) ? event.resource : {}
  const related = isObject(resource.supplementary_data) && isObject(resource.supplementary_data.related_ids) ? resource.supplementary_data.related_ids : {}
  const paypalOrderId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? resource.id : related.order_id
  if (typeof paypalOrderId === 'string') await settlePayPalOrder(c.env, paypalOrderId)
  return c.json({ success: true })
})

const MAX_LINES = 20
const MAX_QTY = 10

/**
 * Creates a pending order. Prices are always taken from the database — the
 * client only says which products (by slug) and how many.
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

  const wanted = new Map<string, number>()
  for (const it of body.items.slice(0, MAX_LINES)) {
    if (!isObject(it)) continue
    const slug = text(it.id, 60)
    const qty = Math.floor(Number(it.quantity))
    if (slug && qty > 0) wanted.set(slug, Math.min(MAX_QTY, (wanted.get(slug) ?? 0) + qty))
  }
  if (wanted.size === 0) return c.json({ success: false, error: 'העגלה ריקה' }, 400)

  const db = c.env.DB
  const slugs = [...wanted.keys()]
  const { results } = await db
    .prepare(`SELECT id, slug, name, price, paypal_url FROM products WHERE active = 1 AND slug IN (${slugs.map(() => '?').join(',')})`)
    .bind(...slugs)
    .all<{ id: number; slug: string; name: string; price: number; paypal_url: string }>()
  if (results.length !== slugs.length) return c.json({ success: false, error: 'חלק מהמוצרים אינם זמינים עוד' }, 409)

  const lines = results.map((p) => ({ ...p, quantity: wanted.get(p.slug)! }))
  const total = Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100

  await db
    .prepare(
      `INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = COALESCE(NULLIF(excluded.phone, ''), customers.phone)`
    )
    .bind(name, email, phone)
    .run()
  const customer = await db.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<{ id: number }>()

  const order = await db
    .prepare(`INSERT INTO orders (customer_id, total_amount, status, payment_method) VALUES (?, ?, 'pending', 'paypal')`)
    .bind(customer!.id, total)
    .run()
  const orderId = order.meta.last_row_id
  await db.batch(
    lines.map((l) =>
      db
        .prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)')
        .bind(orderId, l.id, l.name, l.quantity, l.price)
    )
  )

  // Automatic PayPal checkout when configured; otherwise the storefront falls back to per-product PayPal.me links.
  let approveUrl: string | null = null
  if (paypalEnabled(c.env)) {
    try {
      const brand = ((await getSiteData(db)).design as { brandName?: string }).brandName || 'EcoCraft Digital'
      const pp = await createPayPalOrder(
        c.env,
        { id: orderId, total, items: lines.map((l) => ({ name: l.name, price: l.price, quantity: l.quantity })) },
        new URL(c.req.url).origin,
        brand
      )
      await db.prepare('UPDATE orders SET paypal_order_id = ? WHERE id = ?').bind(pp.paypalOrderId, orderId).run()
      approveUrl = pp.approveUrl
    } catch (e) {
      console.error(e)
    }
  }

  return c.json({
    success: true,
    order: {
      id: orderId,
      total,
      approveUrl,
      items: lines.map((l) => ({ name: l.name, price: l.price, quantity: l.quantity, paypalUrl: l.paypal_url }))
    }
  })
})

/** Where PayPal sends the customer after approving: capture server-side, then hand them to the storefront. */
publicFiles.get('/paypal/return', async (c) => {
  const paypalOrderId = c.req.query('token') ?? ''
  const result = paypalOrderId && paypalEnabled(c.env) ? await settlePayPalOrder(c.env, paypalOrderId).catch(() => 'failed' as const) : 'failed'
  if (result !== 'paid') return c.redirect(`/?payment=${result === 'pending' ? 'pending' : 'failed'}`, 302)
  const row = await c.env.DB.prepare('SELECT download_token FROM orders WHERE paypal_order_id = ?').bind(paypalOrderId).first<{ download_token: string }>()
  return c.redirect(`/?paid=${encodeURIComponent(row!.download_token)}`, 302)
})
publicFiles.get('/paypal/cancel', (c) => c.redirect('/?payment=cancelled', 302))

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

const page = (title: string, body: string) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/static/store.css"></head><body><main><div class="wrap"><div class="success">${body}</div></div></main></body></html>`

publicFiles.get('/download/:token', async (c) => {
  const order = await paidOrder(c.env.DB, c.req.param('token'))
  if (!order) return c.html(page('קישור לא תקין', '<h1>הקישור אינו תקף</h1><p>ההזמנה טרם אושרה או שהקישור שגוי.</p>'), 404)
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, oi.product_name, p.file_url, p.file_id FROM order_items oi
     JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND (p.file_url != '' OR p.file_id IS NOT NULL)`
  )
    .bind(order.id)
    .all<{ id: number; product_name: string }>()
  const rows = results
    .map((r) => `<div class="dl-row"><div class="dl-info"><h4>${escapeHtml(r.product_name)}</h4><a class="btn btn-primary btn-sm" href="/download/${escapeHtml(c.req.param('token'))}/${r.id}">הורדה</a></div></div>`)
    .join('')
  return c.html(page('ההורדות שלך', `<h1>ההורדות שלך</h1><div class="dl-list">${rows || '<p>הקבצים יתווספו בקרוב.</p>'}</div>`))
})

publicFiles.get('/download/:token/:productId', async (c) => {
  const order = await paidOrder(c.env.DB, c.req.param('token'))
  if (!order) return c.notFound()
  const product = await c.env.DB.prepare(
    `SELECT p.file_url, p.file_id FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.id = ?`
  )
    .bind(order.id, c.req.param('productId'))
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

