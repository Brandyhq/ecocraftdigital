import { Hono } from 'hono'
import type { AppEnv } from './env'
import { escapeHtml } from './lib/html'
import { getSiteData, safeJson } from './lib/site'
import admin from './routes/admin'
import { publicApi, publicFiles } from './routes/public'

const app = new Hono<AppEnv>()

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})

app.route('/api/admin', admin)
app.route('/api', publicApi)
app.route('/', publicFiles)

app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

const FONTS =
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Assistant:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Heebo:wght@400;500;700;900&display=swap'

app.get('/', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = site.design as { brandName?: string; heroLead?: string }
  return c.html(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(d.brandName || 'EcoCraft Digital')}</title>
<meta name="description" content="${escapeHtml(d.heroLead || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/static/store.css">
</head><body><div id="app"></div><div class="toast" id="toast"></div>
<script id="appdata" type="application/json">${safeJson(site)}</script>
<script src="/static/store.js"></script>
</body></html>`)
})

// Back office shell. All data comes from the authenticated /api/admin routes.
app.get('/admin', (c) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Frame-Options', 'DENY')
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  )
  return c.html(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>ניהול · EcoCraft Digital</title>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/static/admin.css">
</head><body><div id="root"></div><div class="toast" id="toast"></div>
<script src="/static/admin.js"></script>
</body></html>`)
})

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ success: false, error: 'Not found' }, 404) : c.text('Not found', 404)))

app.onError((err, c) => {
  console.error(err)
  return c.json({ success: false, error: 'Internal error' }, 500)
})

export default app
