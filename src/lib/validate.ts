export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function num(v: unknown, fallback: number | null = null): number | null {
  if (v === '' || v === null || v === undefined) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const isEmail = (s: string) => s.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)

/** Allow only http(s) URLs (blocks javascript:, data: and friends). Empty string is allowed. */
export function httpsUrl(v: unknown, max = 500): string | null {
  const s = text(v, max)
  if (!s) return ''
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}

/** Image source: our own upload/static paths, or an https URL. */
export function imageSrc(v: unknown): string | null {
  const s = text(v, 500)
  if (!s) return ''
  if (/^\/(media|static)\/[\w./-]+$/.test(s) && !s.includes('..')) return s
  return httpsUrl(s)
}

const YT_ID = /^[\w-]{11}$/

/** Accepts YouTube, Vimeo or a direct https video file. Returns the privacy-friendly embed used by the storefront. */
export function parseVideo(v: unknown): { kind: 'youtube' | 'vimeo' | 'file'; embed: string; url: string; thumb: string } | null {
  const s = text(v, 500)
  if (!s) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be' || host === 'youtube.com') {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1] || ''
    if (!YT_ID.test(id)) return null
    return { kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${id}`, url: `https://www.youtube.com/watch?v=${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(\d{5,12})(?:\/([\w]+))?/)
    if (!m) return null
    // Unlisted videos need their privacy hash, either as /ID/HASH or ?h=HASH.
    const hash = m[2] || u.searchParams.get('h') || ''
    if (hash && !/^\w{6,20}$/.test(hash)) return null
    return {
      kind: 'vimeo',
      embed: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ''}`,
      url: `https://vimeo.com/${m[1]}${hash ? `/${hash}` : ''}`,
      thumb: ''
    }
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: 'file', embed: s, url: s, thumb: '' }
  return null
}

export const MAX_GALLERY_IMAGES = 5

export type ProductInput = {
  slug: string | null
  name: string
  short_description: string
  description: string
  includes: string[]
  price: number
  old_price: number | null
  category_id: string | null
  tag: string
  tag_type: string
  rating: number
  reviews: number
  image_url: string
  images: string[]
  video_url: string
  cover_title: string
  cover_sub: string
  cover_from: string
  cover_to: string
  paypal_url: string
  file_url: string
  file_id: string | null
  active: number
  sort_order: number
}

export function parseProduct(body: unknown): Parsed<ProductInput> {
  if (!isObject(body)) return fail('גוף הבקשה אינו תקין')
  const name = text(body.name, 200)
  if (!name) return fail('שם המוצר הוא שדה חובה')
  const price = num(body.price)
  if (price === null || price < 0 || price > 100000) return fail('מחיר לא תקין')
  const oldPrice = num(body.old_price)
  if (oldPrice !== null && (oldPrice < 0 || oldPrice > 100000)) return fail('מחיר קודם לא תקין')
  const slug = text(body.slug, 60).toLowerCase()
  if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) return fail('מזהה (slug) יכול להכיל רק אותיות לועזיות קטנות, ספרות ומקפים')
  const image = imageSrc(body.image_url)
  if (image === null) return fail('כתובת תמונה לא תקינה')
  const images: string[] = []
  for (const raw of Array.isArray(body.images) ? body.images : []) {
    const src = imageSrc(raw)
    if (src === null) return fail('כתובת תמונה בגלריה אינה תקינה')
    if (src && !images.includes(src) && src !== image) images.push(src)
  }
  if (images.length > MAX_GALLERY_IMAGES) return fail(`אפשר להוסיף עד ${MAX_GALLERY_IMAGES} תמונות לגלריה`)
  const videoRaw = text(body.video_url, 500)
  if (videoRaw && !parseVideo(videoRaw)) return fail('קישור הסרטון חייב להיות https מ-YouTube או Vimeo, או קובץ mp4/webm')
  const paypal = httpsUrl(body.paypal_url)
  if (paypal === null) return fail('קישור PayPal חייב להתחיל ב-https://')
  const fileUrl = httpsUrl(body.file_url)
  if (fileUrl === null) return fail('קישור הקובץ חייב להתחיל ב-https://')
  const includes = Array.isArray(body.includes) ? body.includes.map((x) => text(x, 300)).filter(Boolean).slice(0, 30) : []
  const color = (v: unknown) => (isHex(v) ? v : '')
  return {
    ok: true,
    value: {
      slug: slug || null,
      name,
      short_description: text(body.short_description, 500),
      description: text(body.description, 5000),
      includes,
      price,
      old_price: oldPrice,
      category_id: text(body.category_id, 60) || null,
      tag: text(body.tag, 40),
      tag_type: body.tag_type === 'sage' ? 'sage' : 'rose',
      rating: Math.min(5, Math.max(0, num(body.rating, 5) ?? 5)),
      reviews: Math.max(0, Math.floor(num(body.reviews, 0) ?? 0)),
      image_url: image,
      images,
      video_url: videoRaw,
      cover_title: text(body.cover_title, 100),
      cover_sub: text(body.cover_sub, 100),
      cover_from: color(body.cover_from),
      cover_to: color(body.cover_to),
      paypal_url: paypal,
      file_url: fileUrl,
      file_id: text(body.file_id, 80) || null,
      active: body.active === false || body.active === 0 ? 0 : 1,
      sort_order: Math.floor(num(body.sort_order, 0) ?? 0)
    }
  }
}

const HOME_SECTIONS = ['featured', 'categories', 'about', 'info', 'cta', 'features']
const HERO_STYLES = ['side', 'center', 'bg']
const ICONS = ['bolt', 'heart', 'globe', 'star', 'gift']

export type Design = Record<string, unknown>

/** Whitelists and clamps the site design document coming from the editor. */
export function parseDesign(body: unknown): Parsed<Design> {
  if (!isObject(body)) return fail('גוף הבקשה אינו תקין')
  const colors = isObject(body.colors) ? body.colors : {}
  const pick = (k: string, d: string) => (isHex(colors[k]) ? (colors[k] as string) : d)
  const heroImg = imageSrc(body.heroImg)
  const aboutImg = imageSrc(body.aboutImg)
  if (heroImg === null || aboutImg === null) return fail('כתובת תמונה לא תקינה')
  const strings = (v: unknown, max: number, count: number) => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, count) : [])
  const seen = new Set<string>()
  const sections = (Array.isArray(body.homeSections) ? body.homeSections : [])
    .filter((s): s is Record<string, unknown> => isObject(s) && HOME_SECTIONS.includes(s.id as string) && !seen.has(s.id as string) && !!seen.add(s.id as string))
    .map((s) => ({ id: s.id, on: s.on !== false }))
  for (const id of HOME_SECTIONS) if (!seen.has(id)) sections.push({ id, on: true })
  return {
    ok: true,
    value: {
      brandName: text(body.brandName, 60) || 'EcoCraft Digital',
      brandSub: text(body.brandSub, 60),
      logoText: text(body.logoText, 4) || 'ED',
      currency: text(body.currency, 4) || '₪',
      colors: { sage: pick('sage', '#6E8767'), sageDeep: pick('sageDeep', '#4F634A'), rose: pick('rose', '#C98B8B'), cream: pick('cream', '#F6F3EC'), ink: pick('ink', '#3A382F') },
      headingFont: ['Frank Ruhl Libre', 'Assistant', 'Heebo'].includes(body.headingFont as string) ? body.headingFont : 'Frank Ruhl Libre',
      heroStyle: HERO_STYLES.includes(body.heroStyle as string) ? body.heroStyle : 'side',
      homeSections: sections,
      featuredIds: strings(body.featuredIds, 60, 12),
      heroEyebrow: text(body.heroEyebrow, 100),
      heroTitle: text(body.heroTitle, 200),
      heroSubtitle: text(body.heroSubtitle, 200),
      heroLead: text(body.heroLead, 600),
      heroImg,
      aboutImg,
      heroBadge: text(body.heroBadge, 40),
      heroBadgeSub: text(body.heroBadgeSub, 60),
      featuredTitle: text(body.featuredTitle, 120),
      featuredSub: text(body.featuredSub, 300),
      trust: strings(body.trust, 60, 8),
      features: (Array.isArray(body.features) ? body.features : [])
        .filter(isObject)
        .slice(0, 6)
        .map((f) => ({ icon: ICONS.includes(f.icon as string) ? f.icon : 'star', title: text(f.title, 80), body: text(f.body, 300) })),
      aboutTitle: text(body.aboutTitle, 200),
      aboutText: text(body.aboutText, 3000),
      footerTagline: text(body.footerTagline, 300),
      contactEmail: isEmail(text(body.contactEmail, 200)) ? text(body.contactEmail, 200) : '',
      contactPhone: /^[0-9+\-\s]{7,20}$/.test(text(body.contactPhone, 20)) ? text(body.contactPhone, 20) : '',
      whatsappUrl: httpsUrl(body.whatsappUrl) || '',
      instagramUrl: httpsUrl(body.instagramUrl) || '',
      bitUrl: httpsUrl(body.bitUrl) || '',
      businessName: text(body.businessName, 120),
      businessId: text(body.businessId, 60),
      aboutSections: (Array.isArray(body.aboutSections) ? body.aboutSections : [])
        .filter(isObject)
        .slice(0, 8)
        .map((x) => ({ title: text(x.title, 120), body: text(x.body, 3000) }))
        .filter((x) => x.title || x.body)
    }
  }
}
