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
- מיגרציה `0002` מעבירה מוצרים והזמנות קיימים (מוצרים ישנים נכנסים כמוסתרים, הזמנות ששולמו שומרות סטטוס ומקבלות קישור הורדה). \n- המיגרציה מוחקת את משתמש ברירת המחדל `admin/admin123` של הגרסה הישנה, אם קיים.

## תשלום אוטומטי — PayPlus (ביט + אשראי)
1. בחשבון PayPlus: להפעיל על דף התשלום את **ביט** ואשראי, ולהעתיק את מזהה הדף (`payment_page_uid`).
2. ב-Cloudflare (Settings ← Variables and Secrets, Production) להגדיר: `PAYPLUS_API_KEY`, `PAYPLUS_SECRET_KEY` (Secret), `PAYPLUS_PAGE_UID`, `PAYPLUS_ENV` (`sandbox` בהתחלה, אחר כך `production`), ו-`SITE_URL=https://ecocraftdigital.com`. אופציונלי: `PAYPLUS_INVOICES=true` (חשבונית אוטומטית), `RESEND_API_KEY` + `MAIL_FROM` (מייל עם קישור הורדה).
3. `npm run db:migrate:prod` (מיגרציה `0004`).

הזרימה: הלקוחה מסיימת הזמנה ← `POST /api/orders` מחשב מחיר והנחה **בשרת** מ-D1, יוצר הזמנה `pending` ודף תשלום ב-PayPlus ← תשלום ← `POST /api/payplus/callback` (מאומת ב-HMAC-SHA256 על כותרת `hash` + `user-agent: PayPlus`, ובודק שהסכום זהה להזמנה) מסמן `paid` פעם אחת בלבד ← `/checkout/success` מעביר לדף ההורדה האישי (וגם נשלח מייל אם Resend מוגדר).
בלי משתני PayPlus האתר חוזר לתהליך הידני (קישורי PayPal.me לכל מוצר + סימון "שולמה" בבק אופיס).

**חשוב לפני production:** שמות השדות ב-callback נלקחו ממסמך הייחוס (`transaction.uid/status_code/amount/more_info`) ולא נבדקו מול PayPlus אמיתי. בבדיקת ה-sandbox הראשונה יש לוודא שההזמנה עוברת ל-`paid`; אם לא, הלוג של Worker יציג את הסיבה (`amount/uid mismatch` או `without order reference`) — ההזמנה לעולם לא מסומנת כשולמה בלי התאמה.

## נרשמים וקופונים
- טופס ההרשמה בפוטר שומר ל-`subscribers` (דורש אישור דיוור) ומחזיר קוד הנחה אישי וחד-פעמי (15%, בפורמט `W15-XXXXXXXX`). מסך "נרשמים וקופונים" בבק אופיס: רשימה, ייצוא CSV, הוספה וכיבוי של קופונים.
- קופונים מאומתים בשרת (פעיל, לא פג, לא מוצה); השימוש נספר רק אחרי תשלום מאושר.

## אבטחה
- סיסמאות: PBKDF2-SHA256; סשן: עוגיית HttpOnly + SameSite=Strict חתום ב-HMAC, בטל אוטומטית בהחלפת סיסמה; הגבלת ניסיונות התחברות; כותרת `X-Requested-With` חובה בבקשות משנות.
- מחירים בהזמנה מחושבים בשרת בלבד. קבצים דיגיטליים פרטיים ונמסרים רק בקישור אישי אחרי שההזמנה סומנה "שולמה".
- מיגרציה `0002` מעבירה מוצרים והזמנות קיימים (מוצרים ישנים נכנסים כמוסתרים, הזמנות ששולמו שומרות סטטוס ומקבלות קישור הורדה). \n- המיגרציה מוחקת את משתמש ברירת המחדל `admin/admin123` של הגרסה הישנה, אם קיים.

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
