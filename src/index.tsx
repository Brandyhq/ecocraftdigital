import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppEnv, Bindings } from './env'
import { escapeHtml } from './lib/html'
import { getSiteData } from './lib/site'
import type { Site } from './lib/ssr'
import { faqLd, fillVars, firstText, hasPlaceholders, renderBody } from './lib/content'
import { aboutBody, breadcrumbLd, contactBody, homeBody, organizationLd, page, pageHref, productBody, productLd, shopBody, staticBody, SYSTEM_PAGES } from './lib/ssr'
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

/** Canonical origin: SITE_URL when set (custom domain), otherwise the host the request came in on. */
const originOf = (c: { env: Bindings; req: { url: string } }) => (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/+$/, '')
const clip = (s: string, n = 155) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const design = (site: Site) => site.design as { brandName?: string; heroTitle?: string; heroLead?: string; heroImg?: string; aboutText?: string }

app.get('/', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = design(site)
  const origin = originOf(c)
  return c.html(
    page({
      origin, path: '/', site,
      title: `${d.brandName} — ${d.heroTitle}`,
      description: clip(d.heroLead || ''),
      image: d.heroImg,
      jsonld: [organizationLd(site, origin)],
      body: homeBody(site)
    })
  )
})

app.get('/shop', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = design(site)
  const catId = c.req.query('cat') ?? 'all'
  const cat = site.categories.find((x) => x.id === catId && x.count > 0)
  return c.html(
    page({
      // A category view is a filtered copy of /shop, so it points its canonical at /shop.
      origin: originOf(c), path: '/shop', site,
      title: cat ? `${cat.name} | ${d.brandName}` : `כל המוצרים הדיגיטליים | ${d.brandName}`,
      description: clip(`מתכננים דיגיטליים, משחקי למידה וקורסים בעברית — ${site.products.map((p) => p.name).join(', ')}.`),
      image: d.heroImg,
      body: shopBody(site, cat ? cat.id : 'all')
    })
  )
})

app.get('/about', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = design(site)
  return c.html(
    page({
      origin: originOf(c), path: '/about', site,
      title: `עלינו | ${d.brandName}`,
      description: clip((d.aboutText || '').split('\n')[0]),
      image: d.heroImg,
      body: aboutBody(site)
    })
  )
})

app.get('/product/:slug', async (c) => {
  const site = await getSiteData(c.env.DB)
  const p = site.products.find((x) => x.id === c.req.param('slug'))
  if (!p) return c.html('<!doctype html><html lang="he" dir="rtl"><meta name="robots" content="noindex"><title>המוצר לא נמצא</title><body><p>המוצר לא נמצא. <a href="/shop">לכל המוצרים</a></p></body></html>', 404)
  const d = design(site)
  const origin = originOf(c)
  return c.html(
    page({
      origin, path: `/product/${encodeURIComponent(p.id)}`, site, ogType: 'product',
      title: `${p.name} | ${d.brandName}`,
      description: clip(p.short || p.desc),
      image: p.img || d.heroImg,
      jsonld: [productLd(site, p, origin), breadcrumbLd(origin, p)],
      body: productBody(site, p)
    })
  )
})

/** Editable content pages (FAQ, legal, custom). Unpublished pages are 404 for the public. */
async function contentPage(c: Context<AppEnv>, slug: string) {
  const row = await c.env.DB.prepare('SELECT slug, title, body FROM pages WHERE slug = ? AND published = 1').bind(slug).first<{ slug: string; title: string; body: string }>()
  const site = await getSiteData(c.env.DB)
  const d = site.design as Record<string, string>
  if (!row) return c.html(page({ origin: originOf(c), path: '/', site, static: true, noindex: true, title: 'העמוד לא נמצא', description: '', body: staticBody(site, 'העמוד לא נמצא', '<p>העמוד שחיפשת לא קיים. <a href="/shop">לכל המוצרים</a></p>') }), 404)
  const text = fillVars(row.body, { businessName: d.businessName, businessId: d.businessId, contactEmail: d.contactEmail, siteUrl: originOf(c) })
  const origin = originOf(c)
  return c.html(
    page({
      origin, path: pageHref(row.slug), site, static: true,
      title: `${row.title} | ${d.brandName}`,
      description: clip(firstText(text) || row.title),
      jsonld: row.slug === 'faq' ? [faqLd(text)].filter(Boolean) as object[] : [],
      body: staticBody(site, row.title, renderBody(text))
    })
  )
}
for (const slug of SYSTEM_PAGES) app.get(`/${slug}`, (c) => contentPage(c, slug))
app.get('/page/:slug', (c) => contentPage(c, c.req.param('slug')))

app.get('/contact', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = design(site)
  return c.html(page({ origin: originOf(c), path: '/contact', site, static: true, title: `צור קשר | ${d.brandName}`, description: 'שאלה על מוצר, הזמנה או תקלה? כתבו לנו ונחזור אליכם.', body: contactBody(site) }))
})

// Cart and checkout are the same SPA but must stay out of search results.
for (const path of ['/cart', '/checkout']) {
  app.get(path, async (c) => {
    const site = await getSiteData(c.env.DB)
    const d = design(site)
    c.header('X-Robots-Tag', 'noindex')
    return c.html(page({ origin: originOf(c), path, site, noindex: true, title: `${path === '/cart' ? 'עגלת קניות' : 'סיום הזמנה'} | ${d.brandName}`, description: '', body: '' }))
  })
}

app.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /download/\nDisallow: /paypal/\nDisallow: /cart\nDisallow: /checkout\n\nSitemap: ${originOf(c)}/sitemap.xml\n`)
)

app.get('/sitemap.xml', async (c) => {
  const origin = originOf(c)
  const { results } = await c.env.DB.prepare('SELECT slug, updated_at FROM products WHERE active = 1 ORDER BY sort_order, id').all<{ slug: string; updated_at: string | null }>()
  const { results: pageRows } = await c.env.DB.prepare('SELECT slug FROM pages WHERE published = 1').all<{ slug: string }>()
  const urls = [
    `<url><loc>${origin}/</loc></url>`,
    `<url><loc>${origin}/shop</loc></url>`,
    `<url><loc>${origin}/about</loc></url>`,
    `<url><loc>${origin}/contact</loc></url>`,
    ...pageRows.map((r) => `<url><loc>${escapeHtml(origin + pageHref(r.slug))}</loc></url>`),
    ...results.map((r) => `<url><loc>${escapeHtml(`${origin}/product/${encodeURIComponent(r.slug)}`)}</loc>${r.updated_at ? `<lastmod>${r.updated_at.slice(0, 10)}</lastmod>` : ''}</url>`)
  ]
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`, 200, { 'Content-Type': 'application/xml; charset=utf-8' })
})

/** llms.txt is generated from the database so prices and products never go stale. */
app.get('/llms.txt', async (c) => {
  const site = await getSiteData(c.env.DB)
  const d = design(site)
  const origin = originOf(c)
  const lines = [
    `# ${d.brandName}`,
    '',
    `> ${d.heroLead || ''}`,
    '',
    '## מוצרים',
    ...site.products.map((p) => `- [${p.name}](${origin}/product/${encodeURIComponent(p.id)}): ${p.short} ₪${p.price}.`),
    '',
    '## קישורים',
    `- [דף הבית](${origin}/)`,
    `- [כל המוצרים](${origin}/shop)`,
    `- [עלינו](${origin}/about)`,
    `- [צור קשר](${origin}/contact)`,
    ...site.pages.map((p) => `- [${p.title}](${origin}${pageHref(p.slug)})`),
    ''
  ]
  return c.body(lines.join('\n'), 200, { 'Content-Type': 'text/plain; charset=utf-8' })
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
