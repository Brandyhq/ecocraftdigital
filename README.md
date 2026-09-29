# EcoCraft Digital

חנות מוצרים דיגיטליים בעברית (RTL) + בק אופיס מאובטח. Cloudflare Pages + Hono + D1.

## מבנה
| נתיב | תפקיד |
|---|---|
| `public/static/store.js`, `store.css` | החזית (מבוססת האתר המקורי). הנתונים מוזרקים מהשרת ל-`#appdata` |
| `public/static/admin.js`, `admin.css` | הבק אופיס (`/admin`) – SPA ללא תלויות, מותאם ל-CSP קפדני |
| `src/routes/public.ts` | `/api/site`, `/api/orders`, `/media/:id`, `/download/:token` |
| `src/routes/admin.ts` | כל `/api/admin/*` (מוגן) |
| `src/lib/` | הצפנה/סשן (`crypto`, `auth`), ולידציה, נתוני האתר |
| `migrations/` | `0001` סכמה מקורית, `0002` סכמת הבק אופיס (הטבלאות הישנות נשמרות כ-`legacy_*`) |

## הרצה מקומית
```bash
npm ci
cp .dev.vars.example .dev.vars      # ערכי SESSION_SECRET ו-SETUP_TOKEN
npm run db:migrate:local && npm run db:seed
npm run build && npm run dev:sandbox   # http://localhost:3000  ,  /admin
```

## פריסה
1. `wrangler pages secret put SESSION_SECRET` (מחרוזת אקראית ארוכה) ו-`wrangler pages secret put SETUP_TOKEN`.
2. `npm run db:migrate:prod` ואז (פעם אחת) `npm run db:seed:prod`.
3. `npm run deploy`, ואז כנסי ל-`/admin` וצרי את חשבון המנהלת הראשון עם קוד ההתקנה. אחרי היצירה אפשר להסיר את `SETUP_TOKEN`.

## אבטחה
- סיסמאות: PBKDF2-SHA256; סשן: עוגיית HttpOnly + SameSite=Strict חתום ב-HMAC, בטל אוטומטית בהחלפת סיסמה; הגבלת ניסיונות התחברות; כותרת `X-Requested-With` חובה בבקשות משנות.
- מחירים בהזמנה מחושבים בשרת בלבד. קבצים דיגיטליים פרטיים ונמסרים רק בקישור אישי אחרי שההזמנה סומנה "שולמה".
- המיגרציה מוחקת את משתמש ברירת המחדל `admin/admin123` של הגרסה הישנה, אם קיים.

## תהליך הזמנה
לקוח ממלא פרטים ← נוצרת הזמנה `pending` ← משלם ב-PayPal.me ← בבק אופיס מסמנים "שולמה" ← נוצר קישור הורדה אישי (אפשר לשלוח במייל בלחיצה).
אימות תשלום אוטומטי (PayPal webhook / Tranzila) עדיין לא קיים – ראו `PAYMENT_INTEGRATION.md`.

## מגבלות ידועות
- תמונות וקבצים נשמרים ב-D1 (עד ~1.5MB לתמונה, 1.9MB לקובץ). לקבצים גדולים – קישור חיצוני, או מעבר ל-R2.
- אין שליחת מייל אוטומטית.
