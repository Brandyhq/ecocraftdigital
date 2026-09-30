import { escapeHtml as e } from './html'
import { safeJson } from './site'
import type { getSiteData } from './site'

export type Site = Awaited<ReturnType<typeof getSiteData>>
type Product = Site['products'][number]
type Design = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const FONTS =
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Assistant:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Heebo:wght@400;500;700;900&display=swap'

const money = (d: Design, n: number) => `${d.currency || '₪'}${n}`
const abs = (origin: string, url: string) => (/^https?:\/\//.test(url) ? url : origin + url)
const check = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
const ICONS: Record<string, string> = {
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'
}
const cartIcon =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'

const paras = (t: string) => String(t || '').split('\n').filter((x) => x.trim()).map((p) => `<p>${e(p)}</p>`).join('')
const feat = (f: Design) =>
  `<div class="feat"><div class="fi"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[f.icon] || ICONS.star}</svg></div><h4>${e(f.title)}</h4><p>${e(f.body)}</p></div>`

function header(d: Design, active: string) {
  const links: [string, string, string][] = [['home', '/', 'בית'], ['shop', '/shop', 'חנות'], ['about', '/about', 'עלינו']]
  return `<header><div class="wrap"><nav class="nav">
    <a class="logo" href="/" data-nav="home"><div class="mark">${e(d.logoText || 'ED')}</div><div class="name">${e(d.brandName)}<small>${e(d.brandSub || '')}</small></div></a>
    <div class="nav-links" id="navlinks">${links.map(([id, href, label]) => `<a href="${href}" data-nav="${id}" class="${active === id ? 'active' : ''}">${label}</a>`).join('')}</div>
    <div class="nav-icons"><a class="icon-btn" href="/cart" data-nav="cart" aria-label="עגלה">${cartIcon}</a></div>
  </nav></div></header>`
}

function footer(d: Design, cats: Site['categories']) {
  return `<footer><div class="wrap"><div class="foot-grid">
    <div><a class="logo" href="/" data-nav="home" style="margin-bottom:14px"><div class="mark">${e(d.logoText || 'ED')}</div><div class="name">${e(d.brandName)}<small>${e(d.brandSub || '')}</small></div></a><p>${e(d.footerTagline || '')}</p></div>
    <div><h5>חנות</h5>${(cats as { id: string; name: string }[]).map((c) => `<a href="/shop" data-cat="${e(c.id)}">${e(c.name)}</a>`).join('')}<a href="/shop" data-nav="shop">כל המוצרים</a></div>
    <div><h5>מידע</h5><a href="/about" data-nav="about">עלינו</a></div>
  </div><div class="foot-bottom"><span>© 2026 ${e(d.brandName)} · כל הזכויות שמורות</span></div></div></footer>`
}

function card(d: Design, p: Product) {
  const img = p.img ? `<img src="${e(p.img)}" alt="${e(p.name)}" loading="lazy">` : `<div class="gen-cover" style="background:linear-gradient(135deg,${e(p.coverFrom || '#6E8767')},${e(p.coverTo || '#4F634A')})"><div><div class="gc-inner">${e(p.coverTitle || p.name)}</div><small>${e(p.coverSub || '')}</small></div></div>`
  return `<div class="card" data-prod="${e(p.id)}"><div class="thumb">${p.tag ? `<span class="card-tag ${p.tagType === 'sage' ? 'sage' : ''}">${e(p.tag)}</span>` : ''}${img}</div>
    <div class="body"><div class="kicker">${e(p.catName)}</div><h3><a href="/product/${encodeURIComponent(p.id)}" data-plink>${e(p.name)}</a></h3><div class="desc">${e(p.short)}</div>
    <div class="foot"><div class="price">${money(d, p.price)}${p.old ? `<span class="old">${money(d, p.old as number)}</span>` : ''}</div></div></div></div>`
}

export function homeBody(site: Site) {
  const d = site.design as Design
  const ids: string[] = d.featuredIds || []
  const picked = ids.map((id) => site.products.find((p) => p.id === id)).filter(Boolean) as Product[]
  const featured = picked.length ? picked : site.products.slice(0, 3)
  const sec = (id: string) => {
    if (id === 'featured')
      return `<section class="block"><div class="wrap"><div class="sec-head"><span class="eyebrow">הנבחרים שלנו</span><h2>${e(d.featuredTitle || 'מוצרים אהובים במיוחד')}</h2><p>${e(d.featuredSub || '')}</p></div>
        <div class="grid">${featured.map((p) => card(d, p)).join('')}</div><div style="text-align:center;margin-top:34px"><a class="btn btn-ghost" href="/shop" data-nav="shop">לכל המוצרים</a></div></div></section>`
    if (id === 'features') return `<section class="block band"><div class="wrap"><div class="feat-grid">${(d.features || []).map(feat).join('')}</div></div></section>`
    if (id === 'about')
      return `<section class="block"><div class="wrap"><div class="about-grid"><div class="about-media"><img src="${e(d.aboutImg || d.heroImg)}" alt="${e(d.brandName)}" loading="lazy"></div>
        <div><span class="eyebrow">הסיפור שלנו</span><h2>${e(d.aboutTitle)}</h2>${paras(d.aboutText)}<a class="btn btn-primary" href="/about" data-nav="about">קראי עוד עלינו</a></div></div></div></section>`
    return ''
  }
  const first = featured[0]
  const hero = `<section class="hero"><div class="blob a"></div><div class="blob b"></div><div class="wrap"><div class="hero-grid"><div>
    <span class="eyebrow">${e(d.heroEyebrow)}</span><h1>${e(d.heroTitle)}</h1><div class="sub">${e(d.heroSubtitle || '')}</div><p class="lead">${e(d.heroLead)}</p>
    <div class="hero-cta"><a class="btn btn-primary" href="/shop" data-nav="shop">לחנות המלאה</a>${first ? `<a class="btn btn-ghost" href="/product/${encodeURIComponent(first.id)}" data-plink>${e(first.name)} ›</a>` : ''}</div></div>
    <div class="hero-media"><img src="${e(d.heroImg)}" alt="${e(d.brandName)}"></div></div>
    <div class="trust">${(d.trust || []).map((t: string) => `<div class="chip">${check}${e(t)}</div>`).join('')}</div></div></section>`
  return header(d, 'home') + `<main>${hero}${(d.homeSections || []).filter((s: Design) => s.on).map((s: Design) => sec(s.id)).join('')}</main>` + footer(d, site.categories)
}

export function shopBody(site: Site) {
  const d = site.design as Design
  return (
    header(d, 'shop') +
    `<main><div class="page-head"><div class="wrap"><span class="eyebrow">החנות</span><h1>כל המוצרים הדיגיטליים</h1></div></div>
    <section class="block" style="padding-top:26px"><div class="wrap"><div class="grid">${site.products.map((p) => card(d, p)).join('')}</div></div></section></main>` +
    footer(d, site.categories)
  )
}

export function aboutBody(site: Site) {
  const d = site.design as Design
  return (
    header(d, 'about') +
    `<main><div class="page-head"><div class="wrap"><span class="eyebrow">${e(d.brandName)}</span><h1>נעים להכיר</h1></div></div>
    <section class="block" style="padding-top:24px"><div class="wrap"><div class="about-grid"><div class="about-media"><img src="${e(d.aboutImg || d.heroImg)}" alt="${e(d.brandName)}"></div>
    <div><h2>${e(d.aboutTitle)}</h2>${paras(d.aboutText)}<div style="margin-top:22px"><a class="btn btn-primary" href="/shop" data-nav="shop">למוצרים שלנו</a></div></div></div></div></section>
    <section class="block band"><div class="wrap"><div class="feat-grid">${(d.features || []).map(feat).join('')}</div></div></section></main>` +
    footer(d, site.categories)
  )
}

export function productBody(site: Site, p: Product) {
  const d = site.design as Design
  const media = p.img ? `<img src="${e(p.img)}" alt="${e(p.name)}">` : `<div class="gen-cover-wrap"><div class="gen-cover" style="background:linear-gradient(135deg,${e(p.coverFrom || '#6E8767')},${e(p.coverTo || '#4F634A')})"><div><div class="gc-inner">${e(p.coverTitle || p.name)}</div></div></div></div>`
  return (
    header(d, 'shop') +
    `<main><div class="wrap" style="padding-top:26px"><nav class="crumb" aria-label="breadcrumb"><a href="/" data-nav="home">בית</a> › <a href="/shop" data-nav="shop">חנות</a> › ${e(p.name)}</nav>
    <div class="pd"><div class="pd-media">${media}</div><div><div style="color:var(--rose);font-weight:700;font-size:12.5px;margin-bottom:8px">${e(p.catName)}</div>
    <h1>${e(p.name)}</h1><div class="pd-price">${money(d, p.price)}${p.old ? `<span class="old">${money(d, p.old as number)}</span>` : ''}</div>
    <p class="pd-desc">${e(p.desc)}</p><ul class="incl">${p.incl.map((i) => `<li>${check}<span>${e(i)}</span></li>`).join('')}</ul></div></div></div></main>` +
    footer(d, site.categories)
  )
}

type Page = {
  origin: string
  path: string
  title: string
  description: string
  image?: string
  ogType?: string
  jsonld?: object[]
  noindex?: boolean
  body: string
  site: Site
}

/** Full HTML document: unique title/meta/canonical/OG/JSON-LD, pre-rendered body, then the SPA takes over. */
export function page(o: Page) {
  const url = o.origin + o.path
  const image = o.image ? abs(o.origin, o.image) : ''
  const d = o.site.design as Design
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.title)}</title>
<meta name="description" content="${e(o.description)}">
<link rel="canonical" href="${e(url)}">
${o.noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="${o.ogType || 'website'}"><meta property="og:site_name" content="${e(d.brandName)}"><meta property="og:locale" content="he_IL">
<meta property="og:title" content="${e(o.title)}"><meta property="og:description" content="${e(o.description)}"><meta property="og:url" content="${e(url)}">
${image ? `<meta property="og:image" content="${e(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${e(o.title)}"><meta name="twitter:description" content="${e(o.description)}">
${(o.jsonld || []).map((j) => `<script type="application/ld+json">${safeJson(j)}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="/static/store.css">
</head><body><div id="app">${o.body}</div><div class="toast" id="toast"></div>
<script id="appdata" type="application/json">${safeJson(o.site)}</script>
<script src="/static/store.js"></script>
</body></html>`
}

export function organizationLd(site: Site, origin: string) {
  const d = site.design as Design
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: d.brandName,
    url: origin,
    description: d.heroLead,
    inLanguage: 'he-IL',
    currenciesAccepted: 'ILS',
    areaServed: 'IL',
    ...(d.heroImg ? { image: abs(origin, d.heroImg) } : {})
  }
}

export function productLd(site: Site, p: Product, origin: string) {
  const d = site.design as Design
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.short || p.desc,
    sku: p.id,
    ...(p.img ? { image: abs(origin, p.img) } : {}),
    brand: { '@type': 'Brand', name: d.brandName },
    offers: { '@type': 'Offer', url: `${origin}/product/${encodeURIComponent(p.id)}`, price: String(p.price), priceCurrency: 'ILS', availability: 'https://schema.org/InStock' },
    // Only real reviews are ever published.
    ...(p.reviews > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: String(p.rating), reviewCount: String(p.reviews) } } : {})
  }
}

export function breadcrumbLd(origin: string, p: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'בית', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: 'חנות', item: origin + '/shop' },
      { '@type': 'ListItem', position: 3, name: p.name, item: `${origin}/product/${encodeURIComponent(p.id)}` }
    ]
  }
}
