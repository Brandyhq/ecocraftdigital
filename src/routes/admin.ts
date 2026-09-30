import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { currentAdmin, endSession, requireAdmin, startSession } from '../lib/auth'
import { hashPassword, randomToken, timingSafeEqual, verifyPassword } from '../lib/crypto'
import { getSiteData } from '../lib/site'
import { isEmail, isObject, parseDesign, parseProduct, text } from '../lib/validate'

const admin = new Hono<AppEnv>()

const MIN_PASSWORD = 10
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_MAX_FAILURES = 8
// Used to spend the same time on unknown usernames as on real ones.
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

const clientIp = (c: { req: { header: (n: string) => string | undefined } }) => c.req.header('CF-Connecting-IP') ?? 'local'

/* ------------------------------------------------------------------ auth */

admin.get('/session', async (c) => {
  const user = await currentAdmin(c)
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{ n: number }>()
  return c.json({ success: true, authenticated: !!user, username: user?.username ?? null, needsSetup: (count?.n ?? 0) === 0 })
})

admin.post('/setup', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const expected = c.env.SETUP_TOKEN
  const enc = new TextEncoder()
  if (!expected || !timingSafeEqual(enc.encode(String(body.token ?? '')), enc.encode(expected))) {
    return c.json({ success: false, error: 'קוד ההתקנה שגוי' }, 403)
  }
  const username = text(body.username, 40)
  const email = text(body.email, 200).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^[\w.-]{3,40}$/.test(username)) return c.json({ success: false, error: 'שם משתמש: 3–40 תווים (אותיות לועזיות, ספרות, . _ -)' }, 400)
  if (!isEmail(email)) return c.json({ success: false, error: 'אימייל לא תקין' }, 400)
  if (password.length < MIN_PASSWORD) return c.json({ success: false, error: `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD} תווים` }, 400)

  // Atomic "only if there is no admin yet" so two racing requests cannot both win.
  const hash = await hashPassword(password)
  const res = await c.env.DB.prepare(
    'INSERT INTO admin_users (username, password_hash, email) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM admin_users)'
  )
    .bind(username, hash, email)
    .run()
  if (!res.meta.changes) return c.json({ success: false, error: 'כבר קיים מנהל במערכת' }, 409)
  await startSession(c, { id: res.meta.last_row_id, password_hash: hash })
  return c.json({ success: true })
})

admin.post('/login', async (c) => {
  const db = c.env.DB
  const ip = clientIp(c)
  const now = Math.floor(Date.now() / 1000)
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND created_at > ?')
    .bind(ip, now - LOGIN_WINDOW_SECONDS)
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= LOGIN_MAX_FAILURES) return c.json({ success: false, error: 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות.' }, 429)

  const body = await c.req.json().catch(() => null)
  const username = isObject(body) ? text(body.username, 40) : ''
  const password = isObject(body) && typeof body.password === 'string' ? body.password.slice(0, 200) : ''
  const user = await db.prepare('SELECT id, password_hash FROM admin_users WHERE username = ?').bind(username).first<{ id: number; password_hash: string }>()
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) {
    await db.batch([
      db.prepare('INSERT INTO login_attempts (ip, created_at) VALUES (?, ?)').bind(ip, now),
      db.prepare('DELETE FROM login_attempts WHERE created_at < ?').bind(now - LOGIN_WINDOW_SECONDS)
    ])
    return c.json({ success: false, error: 'שם משתמש או סיסמה שגויים' }, 401)
  }
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
  await startSession(c, user)
  return c.json({ success: true })
})

// Everything below requires a valid session.
admin.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (path.endsWith('/logout')) return next() // logging out must never fail
  return requireAdmin(c, next)
})

admin.post('/logout', (c) => {
  endSession(c)
  return c.json({ success: true })
})

admin.post('/password', async (c) => {
  const body = await c.req.json().catch(() => null)
  const current = isObject(body) && typeof body.current === 'string' ? body.current : ''
  const next = isObject(body) && typeof body.next === 'string' ? body.next : ''
  if (next.length < MIN_PASSWORD) return c.json({ success: false, error: `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD} תווים` }, 400)
  const { id } = c.get('admin')
  const user = await c.env.DB.prepare('SELECT password_hash FROM admin_users WHERE id = ?').bind(id).first<{ password_hash: string }>()
  if (!user || !(await verifyPassword(current, user.password_hash))) return c.json({ success: false, error: 'הסיסמה הנוכחית שגויה' }, 403)
  const hash = await hashPassword(next)
  await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(hash, id).run()
  await startSession(c, { id, password_hash: hash }) // other sessions are revoked, this one continues
  return c.json({ success: true })
})

/* ------------------------------------------------------------- dashboard */

const PAID = "('paid','delivered')"

admin.get('/dashboard', async (c) => {
  const db = c.env.DB
  const [totals, series, top, recent] = await db.batch([
    db.prepare(
      `SELECT
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status IN ${PAID}) AS revenue_total,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status IN ${PAID} AND paid_at >= datetime('now','-30 days')) AS revenue_30d,
        (SELECT COUNT(*) FROM orders WHERE status IN ${PAID}) AS orders_paid,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS orders_pending,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM products WHERE active = 1) AS products_active`
    ),
    db.prepare(
      `SELECT date(paid_at) AS day, SUM(total_amount) AS revenue, COUNT(*) AS orders FROM orders
       WHERE status IN ${PAID} AND paid_at >= datetime('now','-29 days') GROUP BY day ORDER BY day`
    ),
    db.prepare(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ${PAID}
       GROUP BY oi.product_name ORDER BY units DESC, revenue DESC LIMIT 5`
    ),
    db.prepare(
      `SELECT o.id, o.total_amount, o.status, o.created_at, cu.name AS customer_name FROM orders o
       JOIN customers cu ON cu.id = o.customer_id ORDER BY o.id DESC LIMIT 8`
    )
  ])
  return c.json({ success: true, totals: totals.results[0], series: series.results, topProducts: top.results, recentOrders: recent.results })
})

/* -------------------------------------------------------------- products */

type ProductRow = Record<string, unknown> & { includes: string; id: number }
const shapeProduct = (p: ProductRow) => ({ ...p, includes: JSON.parse(p.includes || '[]') })

const PRODUCT_COLS = [
  'slug', 'name', 'short_description', 'description', 'includes', 'price', 'old_price', 'category_id', 'tag', 'tag_type', 'rating',
  'reviews', 'image_url', 'cover_title', 'cover_sub', 'cover_from', 'cover_to', 'paypal_url', 'file_url', 'file_id', 'active', 'sort_order'
] as const

admin.get('/products', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, f.filename AS file_name FROM products p LEFT JOIN files f ON f.id = p.file_id ORDER BY p.sort_order, p.id`
  ).all<ProductRow>()
  return c.json({ success: true, products: results.map(shapeProduct) })
})

async function validateRefs(db: D1Database, categoryId: string | null, fileId: string | null) {
  if (categoryId && !(await db.prepare('SELECT 1 AS ok FROM categories WHERE id = ?').bind(categoryId).first())) return 'הקטגוריה שנבחרה אינה קיימת'
  if (fileId && !(await db.prepare('SELECT 1 AS ok FROM files WHERE id = ?').bind(fileId).first())) return 'הקובץ שנבחר אינו קיים'
  return null
}

const isUnique = (e: unknown) => e instanceof Error && /UNIQUE/i.test(e.message)

admin.post('/products', async (c) => {
  const parsed = parseProduct(await c.req.json().catch(() => null))
  if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)
  const v = parsed.value
  const refErr = await validateRefs(c.env.DB, v.category_id, v.file_id)
  if (refErr) return c.json({ success: false, error: refErr }, 400)
  const slug = v.slug ?? `p-${crypto.randomUUID().slice(0, 8)}`
  const values = { ...v, slug, includes: JSON.stringify(v.includes) }
  try {
    const res = await c.env.DB.prepare(`INSERT INTO products (${PRODUCT_COLS.join(', ')}) VALUES (${PRODUCT_COLS.map(() => '?').join(', ')})`)
      .bind(...PRODUCT_COLS.map((k) => values[k]))
      .run()
    return c.json({ success: true, id: res.meta.last_row_id, slug })
  } catch (e) {
    if (isUnique(e)) return c.json({ success: false, error: 'מזהה (slug) זה כבר בשימוש' }, 409)
    throw e
  }
})

admin.put('/products/:id', async (c) => {
  const parsed = parseProduct(await c.req.json().catch(() => null))
  if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)
  const v = parsed.value
  const refErr = await validateRefs(c.env.DB, v.category_id, v.file_id)
  if (refErr) return c.json({ success: false, error: refErr }, 400)
  const existing = await c.env.DB.prepare('SELECT slug FROM products WHERE id = ?').bind(c.req.param('id')).first<{ slug: string }>()
  if (!existing) return c.json({ success: false, error: 'המוצר לא נמצא' }, 404)
  const values = { ...v, slug: v.slug ?? existing.slug, includes: JSON.stringify(v.includes) }
  try {
    await c.env.DB.prepare(`UPDATE products SET ${PRODUCT_COLS.map((k) => `${k} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...PRODUCT_COLS.map((k) => values[k]), c.req.param('id'))
      .run()
    return c.json({ success: true })
  } catch (e) {
    if (isUnique(e)) return c.json({ success: false, error: 'מזהה (slug) זה כבר בשימוש' }, 409)
    throw e
  }
})

admin.delete('/products/:id', async (c) => {
  // Order lines keep a name/price snapshot and (here) a delivery-file snapshot, so paid orders stay fulfillable.
  const id = c.req.param('id')
  const [, res] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE order_items SET file_url = COALESCE((SELECT file_url FROM products WHERE id = ?1), ''), file_id = (SELECT file_id FROM products WHERE id = ?1) WHERE product_id = ?1`
    ).bind(id),
    c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id)
  ])
  return res.meta.changes ? c.json({ success: true }) : c.json({ success: false, error: 'המוצר לא נמצא' }, 404)
})

/* ------------------------------------------------------------ categories */

admin.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT c.id, c.name, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS products FROM categories c ORDER BY c.sort_order, c.name'
  ).all()
  return c.json({ success: true, categories: results })
})

/** Replaces the whole list: upserts the given categories in order and removes the rest. */
admin.put('/categories', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body) || !Array.isArray(body.categories)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const list: { id: string; name: string }[] = []
  for (const raw of body.categories.slice(0, 50)) {
    if (!isObject(raw)) continue
    const name = text(raw.name, 60)
    const id = text(raw.id, 60).toLowerCase() || `c-${crypto.randomUUID().slice(0, 8)}`
    if (!name) return c.json({ success: false, error: 'לכל קטגוריה חייב להיות שם' }, 400)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return c.json({ success: false, error: 'מזהה קטגוריה לא תקין' }, 400)
    if (list.some((x) => x.id === id)) return c.json({ success: false, error: 'מזהה קטגוריה כפול' }, 400)
    list.push({ id, name })
  }
  const db = c.env.DB
  const keep = list.map((x) => x.id)
  await db.batch([
    ...list.map((x, i) =>
      db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order').bind(x.id, x.name, i)
    ),
    keep.length
      ? db.prepare(`DELETE FROM categories WHERE id NOT IN (${keep.map(() => '?').join(',')})`).bind(...keep)
      : db.prepare('DELETE FROM categories')
  ])
  return c.json({ success: true })
})

/* ---------------------------------------------------------------- orders */

const ORDER_STATUSES = ['pending', 'paid', 'delivered', 'cancelled', 'refunded']

admin.get('/orders', async (c) => {
  const status = c.req.query('status') ?? ''
  const q = (c.req.query('q') ?? '').trim().slice(0, 100)
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50))
  const offset = Math.max(0, Number(c.req.query('offset')) || 0)
  const where: string[] = []
  const args: unknown[] = []
  if (ORDER_STATUSES.includes(status)) (where.push('o.status = ?'), args.push(status))
  if (q) {
    where.push('(cu.name LIKE ? OR cu.email LIKE ? OR CAST(o.id AS TEXT) = ?)')
    args.push(`%${q}%`, `%${q}%`, q.replace(/^#/, ''))
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const base = `FROM orders o JOIN customers cu ON cu.id = o.customer_id ${clause}`
  const [rows, count] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT o.id, o.total_amount, o.status, o.created_at, o.paid_at, cu.name AS customer_name, cu.email AS customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items ${base} ORDER BY o.id DESC LIMIT ? OFFSET ?`
    ).bind(...args, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...args)
  ])
  return c.json({ success: true, orders: rows.results, total: (count.results[0] as { n: number }).n })
})

admin.get('/orders/:id', async (c) => {
  const db = c.env.DB
  const order = await db
    .prepare(
      `SELECT o.*, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone
       FROM orders o JOIN customers cu ON cu.id = o.customer_id WHERE o.id = ?`
    )
    .bind(c.req.param('id'))
    .first<Record<string, unknown> & { download_token: string | null }>()
  if (!order) return c.json({ success: false, error: 'ההזמנה לא נמצאה' }, 404)
  const { results: items } = await db
    .prepare('SELECT product_id, product_name, quantity, price FROM order_items WHERE order_id = ?')
    .bind(c.req.param('id'))
    .all()
  const origin = new URL(c.req.url).origin
  const { download_token, ...rest } = order
  return c.json({ success: true, order: { ...rest, items, downloadUrl: download_token ? `${origin}/download/${download_token}` : null } })
})

admin.patch('/orders/:id', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const order = await c.env.DB.prepare('SELECT status, notes, download_token FROM orders WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ status: string; notes: string; download_token: string | null }>()
  if (!order) return c.json({ success: false, error: 'ההזמנה לא נמצאה' }, 404)
  const status = typeof body.status === 'string' ? body.status : order.status
  if (!ORDER_STATUSES.includes(status)) return c.json({ success: false, error: 'סטטוס לא תקין' }, 400)
  const notes = body.notes === undefined ? order.notes : text(body.notes, 2000)
  const grantsAccess = status === 'paid' || status === 'delivered'
  // The token is minted the first time an order is paid; downloads only work while the order is paid/delivered.
  const token = order.download_token ?? (grantsAccess ? randomToken(24) : null)
  await c.env.DB.prepare(
    `UPDATE orders SET status = ?, notes = ?, download_token = ?,
       paid_at = CASE WHEN ? AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
       delivered_at = CASE WHEN ? = 'delivered' AND delivered_at IS NULL THEN CURRENT_TIMESTAMP ELSE delivered_at END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(status, notes, token, grantsAccess ? 1 : 0, status, c.req.param('id'))
    .run()
  return c.json({ success: true })
})

/* ------------------------------------------------------------- customers */

admin.get('/customers', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100)
  const args: unknown[] = q ? [`%${q}%`, `%${q}%`] : []
  const { results } = await c.env.DB.prepare(
    `SELECT cu.id, cu.name, cu.email, cu.phone, cu.created_at,
       COUNT(o.id) AS orders,
       COALESCE(SUM(CASE WHEN o.status IN ${PAID} THEN o.total_amount END), 0) AS total_spent,
       MAX(o.created_at) AS last_order_at
     FROM customers cu LEFT JOIN orders o ON o.customer_id = cu.id
     ${q ? 'WHERE cu.name LIKE ? OR cu.email LIKE ?' : ''}
     GROUP BY cu.id ORDER BY total_spent DESC, cu.id DESC LIMIT 200`
  )
    .bind(...args)
    .all()
  return c.json({ success: true, customers: results })
})

/* ----------------------------------------------------- content pages & messages */

admin.get('/pages', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT slug, title, body, published, updated_at FROM pages ORDER BY slug').all()
  return c.json({ success: true, pages: results })
})

admin.put('/pages/:slug', async (c) => {
  const body = await c.req.json().catch(() => null)
  const slug = c.req.param('slug').toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return c.json({ success: false, error: 'מזהה עמוד לא תקין (אותיות לועזיות קטנות, ספרות ומקפים)' }, 400)
  if (!isObject(body)) return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  const title = text(body.title, 150)
  if (!title) return c.json({ success: false, error: 'כותרת העמוד חובה' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO pages (slug, title, body, published, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, body = excluded.body, published = excluded.published, updated_at = CURRENT_TIMESTAMP`
  )
    .bind(slug, title, typeof body.body === 'string' ? body.body.slice(0, 40000) : '', body.published === true ? 1 : 0)
    .run()
  return c.json({ success: true })
})

admin.delete('/pages/:slug', async (c) => {
  if (['faq', 'terms', 'privacy', 'refunds'].includes(c.req.param('slug'))) return c.json({ success: false, error: 'אי אפשר למחוק עמוד מערכת. אפשר להסתיר אותו.' }, 400)
  const res = await c.env.DB.prepare('DELETE FROM pages WHERE slug = ?').bind(c.req.param('slug')).run()
  return res.meta.changes ? c.json({ success: true }) : c.json({ success: false, error: 'העמוד לא נמצא' }, 404)
})

admin.get('/messages', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, email, order_ref, message, handled, created_at FROM contact_messages ORDER BY handled, id DESC LIMIT 200').all()
  return c.json({ success: true, messages: results })
})

admin.patch('/messages/:id', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!isObject(body) || typeof body.handled !== 'boolean') return c.json({ success: false, error: 'בקשה לא תקינה' }, 400)
  await c.env.DB.prepare('UPDATE contact_messages SET handled = ? WHERE id = ?').bind(body.handled ? 1 : 0, c.req.param('id')).run()
  return c.json({ success: true })
})

/* ---------------------------------------------------------- site content */

admin.get('/design', async (c) => c.json({ success: true, design: (await getSiteData(c.env.DB)).design }))

admin.put('/design', async (c) => {
  const parsed = parseDesign(await c.req.json().catch(() => null))
  if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)
  await c.env.DB.prepare(
    "INSERT INTO site_settings (key, value, updated_at) VALUES ('design', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
  )
    .bind(JSON.stringify(parsed.value))
    .run()
  return c.json({ success: true })
})

/* --------------------------------------------------------------- uploads */

const MAX_IMAGE = 1_500_000
const MAX_FILE = 1_900_000 // D1 rows are capped at ~2MB
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
}

async function readBody(c: { req: { header: (n: string) => string | undefined; arrayBuffer: () => Promise<ArrayBuffer> } }, max: number) {
  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > max) return null
  const buf = await c.req.arrayBuffer()
  return buf.byteLength > 0 && buf.byteLength <= max ? buf : null
}

admin.post('/media', async (c) => {
  const mime = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const sigs = IMAGE_SIGNATURES[mime]
  if (!sigs) return c.json({ success: false, error: 'נתמכים רק PNG, JPG, WEBP ו-GIF' }, 415)
  const buf = await readBody(c, MAX_IMAGE)
  if (!buf) return c.json({ success: false, error: 'התמונה גדולה מדי (עד 1.5MB)' }, 413)
  const head = new Uint8Array(buf.slice(0, 4))
  if (!sigs.some((sig) => sig.every((b, i) => head[i] === b))) return c.json({ success: false, error: 'תוכן הקובץ אינו תואם לסוג התמונה' }, 415)
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO media (id, mime, size, data) VALUES (?, ?, ?, ?)').bind(id, mime, buf.byteLength, buf).run()
  return c.json({ success: true, url: `/media/${id}` })
})

admin.post('/files', async (c) => {
  let filename = 'download'
  try {
    filename = decodeURIComponent(c.req.header('X-Filename') ?? '') || filename
  } catch {
    /* keep default */
  }
  filename = filename.replace(/[\\/\r\n]/g, '_').slice(0, 150)
  const buf = await readBody(c, MAX_FILE)
  if (!buf) return c.json({ success: false, error: 'הקובץ גדול מדי להעלאה (עד 1.9MB). לקבצים גדולים יותר השתמשי בקישור חיצוני.' }, 413)
  const id = crypto.randomUUID()
  const mime = (c.req.header('content-type') ?? 'application/octet-stream').split(';')[0].trim().slice(0, 100)
  await c.env.DB.prepare('INSERT INTO files (id, filename, mime, size, data) VALUES (?, ?, ?, ?, ?)').bind(id, filename, mime, buf.byteLength, buf).run()
  return c.json({ success: true, id, filename })
})

export default admin
