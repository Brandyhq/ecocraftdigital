import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { issueSession, pinMatches, sessionValid } from './auth.ts'
import { purgeInactive } from './retention.ts'
import {
  STAMP_COOLDOWN_SECONDS, birthdayAvailable, currentYear, newToken, normalizePhone,
  parseBirthday, rewardReady, stampMultiplier, toCsv, formatPhone, formatIsraelTime, EVENT_LABELS, buildManifest,
} from './logic.ts'
import { cardPage, joinPage, privacyPage, staffLoginPage, staffPage } from './pages.ts'

type Env = {
  Bindings: {
    DB: D1Database
    SHOP_NAME: string
    REWARD_TEXT: string
    STAMPS_NEEDED: string
    DOUBLE_STAMP_DAYS: string
    CONTACT_PHONE: string
    RETENTION_MONTHS: string
    STAFF_PIN: string
    SESSION_SECRET: string
  }
}
type Card = {
  id: number; token: string; name: string; phone: string; stamps: number; rewards_redeemed: number
  birthday: string | null; birthday_reward_year: number | null; created_at: string; marketing_consent: number
}

const app = new Hono<Env>()
const retentionMonths = (e: Env['Bindings']) => Math.max(1, Number(e.RETENTION_MONTHS) || 24)
const needed = (e: Env['Bindings']) => Math.max(1, Number(e.STAMPS_NEEDED) || 10)
const publicCard = (c: Card, env: Env['Bindings']) => ({
  token: c.token,
  name: c.name,
  stamps: c.stamps,
  rewardReady: rewardReady(c.stamps, needed(env)),
  birthdayGift: birthdayAvailable(c),
  multiplier: stampMultiplier(env.DOUBLE_STAMP_DAYS ?? ''),
})
const getByToken = (db: D1Database, token: string) =>
  db.prepare('SELECT * FROM cards WHERE token = ?').bind(token).first<Card>()

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cache-Control', 'no-store')
})

// --- customer ---
app.get('/', (c) => c.redirect('/join'))
app.get('/join', (c) => c.html(joinPage(c.env.SHOP_NAME, c.env.REWARD_TEXT, needed(c.env))))
app.get('/privacy', (c) => c.html(privacyPage(c.env.SHOP_NAME, c.env.CONTACT_PHONE, retentionMonths(c.env))))

app.post('/join', async (c) => {
  const form = await c.req.parseBody()
  const name = String(form.name ?? '').trim().slice(0, 60)
  const phone = normalizePhone(String(form.phone ?? ''))
  const page = (err: string) => c.html(joinPage(c.env.SHOP_NAME, c.env.REWARD_TEXT, needed(c.env), err), 400)
  if (!name) return page('נא למלא שם')
  if (!phone) return page('מספר טלפון לא תקין')
  const bm = String(form.bmonth ?? ''), bd = String(form.bday ?? '')
  const birthday = bm || bd ? parseBirthday(bm, bd) : null
  if ((bm || bd) && !birthday) return page('יום ההולדת אינו תקין')
  const token = newToken()
  try {
    await c.env.DB.prepare('INSERT INTO cards (token, name, phone, marketing_consent, birthday) VALUES (?, ?, ?, ?, ?)')
      .bind(token, name, phone, form.consent === '1' ? 1 : 0, birthday).run()
  } catch {
    return page('כבר קיים כרטיס למספר הזה. בקשי מהצוות לשלוח לך שוב את הקישור.')
  }
  return c.redirect(`/c/${token}`)
})

app.get('/c/:token/manifest.webmanifest', async (c) => {
  const card = await getByToken(c.env.DB, c.req.param('token'))
  if (!card) return c.text('כרטיס לא נמצא', 404)
  return c.body(JSON.stringify(buildManifest(c.env.SHOP_NAME, card.token)), 200, {
    'Content-Type': 'application/manifest+json; charset=utf-8',
  })
})

app.get('/c/:token', async (c) => {
  const card = await getByToken(c.env.DB, c.req.param('token'))
  if (!card) return c.text('כרטיס לא נמצא', 404)
  return c.html(cardPage(c.env.SHOP_NAME, c.env.REWARD_TEXT, needed(c.env), publicCard(card, c.env)))
})

// --- staff auth ---
app.get('/staff', async (c) => {
  if (await sessionValid(c.env.SESSION_SECRET, getCookie(c, 'staff'))) return c.html(staffPage(c.env.SHOP_NAME, needed(c.env)))
  return c.html(staffLoginPage(c.env.SHOP_NAME))
})

app.post('/staff/login', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
  const recent = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND created_at > datetime('now','-10 minutes')",
  ).bind(ip).first<{ n: number }>()
  if ((recent?.n ?? 0) >= 8) return c.html(staffLoginPage(c.env.SHOP_NAME, 'יותר מדי ניסיונות, נסי שוב בעוד כמה דקות'), 429)
  const form = await c.req.parseBody()
  if (!(await pinMatches(String(form.pin ?? ''), c.env.STAFF_PIN))) {
    await c.env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run()
    return c.html(staffLoginPage(c.env.SHOP_NAME, 'קוד שגוי'), 401)
  }
  setCookie(c, 'staff', await issueSession(c.env.SESSION_SECRET), {
    httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 12 * 3600,
  })
  return c.redirect('/staff')
})

const requireStaff = async (c: any, next: () => Promise<void>) => {
  if (!(await sessionValid(c.env.SESSION_SECRET, getCookie(c, 'staff')))) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
app.use('/api/staff/*', requireStaff)

// --- staff API ---
app.post('/api/staff/lookup', async (c) => {
  const b = await c.req.json<{ token?: string; phone?: string }>().catch(() => ({} as { token?: string; phone?: string }))
  let card: Card | null = null
  if (b.token) card = await getByToken(c.env.DB, String(b.token))
  else if (b.phone) {
    const p = normalizePhone(String(b.phone))
    if (p) card = await c.env.DB.prepare('SELECT * FROM cards WHERE phone = ?').bind(p).first<Card>()
  }
  return card ? c.json({ card: publicCard(card, c.env) }) : c.json({ error: 'כרטיס לא נמצא' }, 404)
})

app.post('/api/staff/stamp', async (c) => {
  const b = await c.req.json<{ token?: string; count?: number }>().catch(() => ({} as { token?: string; count?: number }))
  const count = Math.min(5, Math.max(1, Math.floor(Number(b.count) || 1)))
  const card = await getByToken(c.env.DB, String(b.token ?? ''))
  if (!card) return c.json({ error: 'כרטיס לא נמצא' }, 404)
  const last = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM card_events WHERE card_id = ? AND kind = 'stamp' AND created_at > datetime('now', ?)",
  ).bind(card.id, `-${STAMP_COOLDOWN_SECONDS} seconds`).first<{ n: number }>()
  if ((last?.n ?? 0) > 0) return c.json({ error: 'נחתם הרגע – מניעת חתימה כפולה, נסי שוב בעוד חצי דקה' }, 409)
  const max = needed(c.env)
  const room = Math.max(0, max - card.stamps) // never exceed a full card; redeem first
  if (room === 0) return c.json({ error: 'הכרטיס מלא – יש לממש מתנה קודם' }, 409)
  const add = Math.min(count * stampMultiplier(c.env.DOUBLE_STAMP_DAYS ?? ''), room)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cards SET stamps = stamps + ? WHERE id = ?').bind(add, card.id),
    c.env.DB.prepare("INSERT INTO card_events (card_id, kind) VALUES (?, 'stamp')").bind(card.id),
  ])
  return c.json({ card: publicCard({ ...card, stamps: card.stamps + add }, c.env) })
})

app.post('/api/staff/redeem', async (c) => {
  const b = await c.req.json<{ token?: string }>().catch(() => ({} as { token?: string }))
  const card = await getByToken(c.env.DB, String(b.token ?? ''))
  if (!card) return c.json({ error: 'כרטיס לא נמצא' }, 404)
  const max = needed(c.env)
  if (!rewardReady(card.stamps, max)) return c.json({ error: 'אין מספיק חותמות' }, 409)
  // Guarded update: concurrent redeems cannot both succeed.
  const res = await c.env.DB.prepare(
    'UPDATE cards SET stamps = stamps - ?1, rewards_redeemed = rewards_redeemed + 1 WHERE id = ?2 AND stamps >= ?1',
  ).bind(max, card.id).run()
  if (!res.meta.changes) return c.json({ error: 'אין מספיק חותמות' }, 409)
  await c.env.DB.prepare("INSERT INTO card_events (card_id, kind) VALUES (?, 'redeem')").bind(card.id).run()
  return c.json({ card: publicCard({ ...card, stamps: card.stamps - max }, c.env) })
})

app.post('/api/staff/redeem-birthday', async (c) => {
  const b = await c.req.json<{ token?: string }>().catch(() => ({} as { token?: string }))
  const card = await getByToken(c.env.DB, String(b.token ?? ''))
  if (!card) return c.json({ error: 'כרטיס לא נמצא' }, 404)
  if (!birthdayAvailable(card)) return c.json({ error: 'אין מתנת יום הולדת זמינה' }, 409)
  const year = currentYear()
  // Guarded update: the gift can be given once per calendar year even under concurrent requests.
  const res = await c.env.DB.prepare(
    'UPDATE cards SET birthday_reward_year = ?1 WHERE id = ?2 AND (birthday_reward_year IS NULL OR birthday_reward_year <> ?1)',
  ).bind(year, card.id).run()
  if (!res.meta.changes) return c.json({ error: 'אין מתנת יום הולדת זמינה' }, 409)
  await c.env.DB.prepare("INSERT INTO card_events (card_id, kind) VALUES (?, 'birthday')").bind(card.id).run()
  return c.json({ card: publicCard({ ...card, birthday_reward_year: year }, c.env) })
})

const csvResponse = (c: any, csv: string, filename: string) =>
  c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })

// ?marketing=1 limits the export to customers who agreed to receive messages.
app.get('/staff/export.csv', async (c) => {
  if (!(await sessionValid(c.env.SESSION_SECRET, getCookie(c, 'staff')))) return c.redirect('/staff')
  const marketing = c.req.query('marketing') === '1'
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM cards ${marketing ? 'WHERE marketing_consent = 1' : ''} ORDER BY created_at`,
  ).all<Card>()
  const csv = toCsv([
    ['שם', 'טלפון', 'יום הולדת', 'חותמות', 'מתנות שמומשו', 'אישור שיווק', 'נרשם'],
    ...results.map((r) => [
      r.name, formatPhone(r.phone), r.birthday, r.stamps, r.rewards_redeemed,
      r.marketing_consent ? 'כן' : 'לא', formatIsraelTime(r.created_at),
    ]),
  ])
  return csvResponse(c, csv, marketing ? 'customers-marketing.csv' : 'customers.csv')
})

// Every stamp, redemption and birthday gift, in Israel time. Capped so a huge history cannot exhaust the Worker.
app.get('/staff/export-events.csv', async (c) => {
  if (!(await sessionValid(c.env.SESSION_SECRET, getCookie(c, 'staff')))) return c.redirect('/staff')
  const { results } = await c.env.DB.prepare(
    `SELECT e.created_at, e.kind, c.name, c.phone FROM card_events e JOIN cards c ON c.id = e.card_id
     ORDER BY e.created_at, e.id LIMIT 50000`,
  ).all<{ created_at: string; kind: string; name: string; phone: string }>()
  const csv = toCsv([
    ['תאריך ושעה', 'שם', 'טלפון', 'פעולה'],
    ...results.map((r) => [formatIsraelTime(r.created_at), r.name, formatPhone(r.phone), EVENT_LABELS[r.kind] ?? r.kind]),
  ])
  return csvResponse(c, csv, 'stamp-history.csv')
})

export default {
  fetch: app.fetch,
  // Monthly cron: delete cards inactive for RETENTION_MONTHS (matches /privacy).
  async scheduled(_event: ScheduledEvent, env: Env['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(purgeInactive(env.DB, retentionMonths(env)))
  },
}
