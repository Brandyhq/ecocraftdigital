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

## תשלום PayPal אוטומטי
1. ב-[PayPal Developer](https://developer.paypal.com) צרי אפליקציית REST (בסביבת sandbox לבדיקה, live לפרודקשן).
2. הגדירי secrets: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`live` בפרודקשן; ברירת מחדל sandbox), ואופציונלית `PAYPAL_WEBHOOK_ID`.
3. `npm run db:migrate:prod` (מיגרציה `0003`).
4. ב-PayPal הוסיפי webhook לכתובת `https://<הדומיין>/api/paypal/webhook` עם האירועים `CHECKOUT.ORDER.APPROVED` ו-`PAYMENT.CAPTURE.COMPLETED` (רשת ביטחון למקרה שהלקוחה סגרה את הדפדפן לפני החזרה לאתר).

הזרימה: לקוחה ממלאת פרטים ← נוצרת הזמנה `pending` + הזמנת PayPal ב-ILS (המחיר מחושב בשרת) ← אישור ב-PayPal ← `/paypal/return` שואל את PayPal מה המצב, מבצע capture, בודק שהסכום והמטבע תואמים, ורק אז מסמן `paid` ומעביר אותה לקישור ההורדה האישי.
בלי הגדרת המשתנים – האתר חוזר לתהליך הידני (קישורי PayPal.me + סימון "שולמה" בבק אופיס).

## מגבלות ידועות
- תמונות וקבצים נשמרים ב-D1 (עד ~1.5MB לתמונה, 1.9MB לקובץ). לקבצים גדולים – קישור חיצוני, או מעבר ל-R2.
- אין שליחת מייל אוטומטית.
- החזרים (refund) ב-PayPal לא מסתנכרנים אוטומטית – יש לעדכן סטטוס ידנית בבק אופיס.
- אם PayPal חייב סכום שאינו תואם להזמנה, ההזמנה נשארת `pending` ונרשמת שגיאה בלוג — יש לבדוק ידנית.
