# CLAUDE.md

## הפרויקט
- שני פרויקטים ב-repo אחד, שניהם Hono על Cloudflare עם D1:
  - שורש ה-repo: storefront עם back office ותשלומי PayPal (Cloudflare Pages, מסד `ecocraft-production`).
  - `coffee-card/`: כרטיס נאמנות לעגלת קפה (Cloudflare Worker, מסד `coffee-card`). יש לו `package.json` ו-`wrangler.jsonc` משלו.
- אין כאן Next.js ואין Supabase.

## עבודה
- תמיד להריץ בדיקות אחרי שינוי:
  - בשורש: `npm test` (בודק טיפוסים).
  - ב-`coffee-card/`: `cd coffee-card && npm test` (טיפוסים ובדיקות יחידה).
- לא לגעת בקבצים מחוץ למשימה. שינוי ב-`coffee-card/` לא נוגע ב-storefront, ולהפך.
- סודות (`STAFF_PIN`, `SESSION_SECRET`) לא נשמרים בקוד. מקומית הם ב-`.dev.vars`, שנמצא ב-`.gitignore`.
- שינוי במבנה המסד נעשה במיגרציה חדשה בתיקיית `migrations/` של הפרויקט הרלוונטי, ולא בעריכת מיגרציה קיימת.

## כתיבה
- כותבים בעברית, בלי מקפים ארוכים.
