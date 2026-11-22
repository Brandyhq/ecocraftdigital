import { Hono } from 'hono'
import type { AppEnv } from '../env'

export const catalog = new Hono<AppEnv>()

type Row = {
  id: number
  slug: string
  name: string
  price: number
  price_agorot: number
  old_price: number | null
  old_price_agorot: number | null
  category_id: string | null
  tag: string
  image_url: string
  short_description: string
  access_url: string
  file_id: string | null
  file_url: string
}

/**
 * Public catalog (ECOMMERCE_SPEC.md, section 3). Prices are whole agorot, VAT included.
 * Never exposes delivery details: no R2 keys, external links or access URLs, only whether a product can be delivered.
 */
catalog.get('/', async (c) => {
  const db = c.env.DB
  const [products, files] = await db.batch([
    db.prepare(
      `SELECT id, slug, name, price, price_agorot, old_price, old_price_agorot, category_id, tag, image_url, short_description,
              access_url, file_id, file_url
       FROM products WHERE active = 1 ORDER BY sort_order, id`
    ),
    db.prepare('SELECT product_id, label_he, sort FROM product_files ORDER BY product_id, sort, id')
  ])
  const labels = new Map<number, { label_he: string; sort: number }[]>()
  for (const f of files.results as { product_id: number; label_he: string; sort: number }[]) {
    labels.set(f.product_id, [...(labels.get(f.product_id) ?? []), { label_he: f.label_he, sort: f.sort }])
  }
  return c.json({
    success: true,
    currency: 'ILS',
    vat_included: true,
    products: (products.results as Row[]).map((p) => {
      const productFiles = labels.get(p.id) ?? []
      const hasFiles = productFiles.length > 0 || !!p.file_id || !!p.file_url.trim()
      const hasAccess = !!p.access_url.trim()
      return {
        slug: p.slug,
        name_he: p.name,
        price_agorot: p.price_agorot || Math.round(p.price * 100),
        old_price_agorot: p.old_price_agorot ?? (p.old_price === null ? null : Math.round(p.old_price * 100)),
        category: p.category_id,
        badge: p.tag,
        image: p.image_url,
        short_desc_he: p.short_description,
        delivery_type: hasFiles && hasAccess ? 'both' : hasFiles ? 'file' : hasAccess ? 'access' : 'none',
        // Only what the paid-order flow can hand over today. Access links join in stage 4, when delivery consumes them.
        deliverable: hasFiles,
        files: productFiles
      }
    })
  })
})
