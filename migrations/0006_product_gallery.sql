-- Product gallery: extra images (JSON array of URLs, max 5) and one optional video link.
-- products.image_url stays the main image and the first slide.
ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
