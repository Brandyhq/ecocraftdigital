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
}

const DEFAULT_SECTIONS = [
  { id: 'featured', on: true },
  { id: 'features', on: true },
  { id: 'about', on: true }
]

/** Shape consumed by public/static/store.js. Never includes private file links. */
export async function getSiteData(db: D1Database) {
  const [settings, categories, products] = await db.batch([
    db.prepare("SELECT value FROM site_settings WHERE key = 'design'"),
    db.prepare('SELECT id, name FROM categories ORDER BY sort_order, name'),
    db.prepare(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1 ORDER BY p.sort_order, p.id`
    )
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
  design.homeSections ??= DEFAULT_SECTIONS
  design.featuredIds ??= []

  return {
    design,
    categories: categories.results,
    products: (products.results as ProductRow[]).map((p) => ({
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
      paypalUrl: p.paypal_url
    }))
  }
}

/** JSON that is safe to embed inside a <script type="application/json"> tag. */
export const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
