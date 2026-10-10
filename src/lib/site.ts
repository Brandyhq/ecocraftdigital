import type { Design } from './validate'

type ProductRow = {
  slug: string
  category_id: string | null
  category_name: string | null
  name: string
  price: number
  old_price: number | null
  tag: string
  tag_type: string
  rating: number
  reviews: number
  image_url: string
  short_description: string
  description: string
  includes: string
  cover_title: string
  cover_sub: string
  cover_from: string
  cover_to: string
  paypal_url: string
  file_url: string
  file_id: string | null
}

/** Default home hero copy; stored values (editable in the back office) win, these fill empty fields only. */
export const DEFAULT_HERO = {
  heroTitle: 'פשוט יותר. חכם יותר. מודע יותר.',
  heroLead:
    'מוצרים דיגיטליים שנוצרו מתוך מחשבה, כדי לעזור לכם להתארגן, ליצור ולעבוד בצורה פשוטה ויעילה יותר.\nמתבניות שימושיות ועד כלי יצירה ובינה מלאכותית — כאן תמצאו פתרונות שנועדו להפוך רעיונות למעשים ולהקל על הדברים הקטנים והגדולים בחיים.'
}

type Section = { id: string; on: boolean }

/** Order of the home page sections. "features" (free-text claims) is off by default; "info" replaces it with verified facts. */
const DEFAULT_SECTIONS: Section[] = [
  { id: 'featured', on: true },
  { id: 'categories', on: true },
  { id: 'about', on: true },
  { id: 'info', on: true },
  { id: 'cta', on: true },
  { id: 'features', on: false }
]
const NEW_SECTION_IDS = ['categories', 'info', 'cta']

/**
 * A stored list written before the new sections existed is treated as legacy and replaced by the default
 * order; once the back office saves a list that already contains them, that list is respected as is.
 */
function normalizeSections(stored: unknown): Section[] {
  if (!Array.isArray(stored) || !stored.length) return DEFAULT_SECTIONS
  const ids = stored.map((s: Section) => s?.id)
  if (!NEW_SECTION_IDS.every((id) => ids.includes(id))) return DEFAULT_SECTIONS
  return stored.filter((s: Section) => s && typeof s.id === 'string').map((s: Section) => ({ id: s.id, on: s.on !== false }))
}

/**
 * Featured products for the home page: configured ids first, only products that actually have a delivery
 * file or link (nothing is sold on the home page that cannot be delivered), 3 to 4 items.
 */
function pickFeatured(products: { id: string; deliverable: boolean }[], ids: string[]): string[] {
  const ok = (id: string) => products.some((p) => p.id === id && p.deliverable)
  const picked = ids.filter(ok).slice(0, 4)
  for (const p of products) {
    if (picked.length >= 3) break
    if (p.deliverable && !picked.includes(p.id)) picked.push(p.id)
  }
  return picked
}

/** Shape consumed by public/static/store.js. Never includes private file links. */
export async function getSiteData(db: D1Database) {
  const [settings, categories, products, pages] = await db.batch([
    db.prepare("SELECT value FROM site_settings WHERE key = 'design'"),
    db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name'),
    db.prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1 ORDER BY p.sort_order, p.id`
    ),
    db.prepare('SELECT slug, title FROM pages WHERE published = 1 ORDER BY CASE slug WHEN \'faq\' THEN 0 WHEN \'terms\' THEN 1 WHEN \'privacy\' THEN 2 WHEN \'refunds\' THEN 3 ELSE 4 END, title')
  ])

  let design: Design = {}
  const raw = (settings.results[0] as { value: string } | undefined)?.value
  if (raw) {
    try {
      design = JSON.parse(raw)
    } catch {
      /* fall through to defaults */
    }
  }
  design.heroTitle ||= DEFAULT_HERO.heroTitle
  design.heroLead ||= DEFAULT_HERO.heroLead
  design.homeSections = normalizeSections(design.homeSections)
  design.featuredIds ??= []

  const list = (products.results as ProductRow[]).map((p) => ({
      id: p.slug,
      cat: p.category_id ?? '',
      catName: p.category_name ?? '',
      name: p.name,
      price: p.price,
      old: p.old_price ?? '',
      tag: p.tag,
      tagType: p.tag_type,
      rating: p.rating,
      reviews: p.reviews,
      img: p.image_url,
      short: p.short_description,
      desc: p.description,
      incl: JSON.parse(p.includes || '[]') as string[],
      coverTitle: p.cover_title,
      coverSub: p.cover_sub,
      coverFrom: p.cover_from,
      coverTo: p.cover_to,
      paypalUrl: p.paypal_url,
      // Only whether something can be delivered is public; the file link itself never leaves the server.
      deliverable: !!(p.file_id || (p.file_url && p.file_url.trim()))
    }))

  const counts = new Map<string, number>()
  for (const p of list) if (p.cat) counts.set(p.cat, (counts.get(p.cat) ?? 0) + 1)

  return {
    design,
    // Same categories as in the database, with how many active products each one has.
    categories: (categories.results as { id: string; name: string }[]).map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
    featured: pickFeatured(list, design.featuredIds as string[]),
    pages: pages.results as { slug: string; title: string }[],
    products: list
  }
}

/** JSON that is safe to embed inside a <script type="application/json"> tag. */
export const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
