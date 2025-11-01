# ECOCRAFTDIGITAL - חנות מוצרים דיגיטליים מתקדמת

## סקירה כללית

**ECOCRAFTDIGITAL** היא פלטפורמה מלאה למכירת מוצרים דיגיטליים איכותיים לקהל הישראלי. האתר כולל ממשק לקוחות מתקדם, פאנל ניהול מקצועי, מסד נתונים מלא והכנה לשערי תשלום.

## 🎯 תכונות מושלמות

### 1. ממשק לקוחות
- ✅ עיצוב מודרני ומותאם לעברית (RTL)
- ✅ ממשק רספונסיבי למובייל וטאבלט
- ✅ עגלת קניות מתקדמת עם שמירה ב-localStorage
- ✅ תהליך הזמנה מלא עם שמירה למסד נתונים
- ✅ טעינת מוצרים דינמית מ-API
- ✅ הודעות משוב למשתמש

### 2. מסד נתונים Cloudflare D1
- ✅ 5 טבלאות: products, customers, orders, order_items, admin_users
- ✅ מיגרציות מובנות
- ✅ 6 מוצרי דוגמה מוכנים
- ✅ אינדקסים לביצועים מיטביים
- ✅ תמיכה מלאה בפיתוח מקומי (--local mode)

### 3. API מלא
- ✅ `GET /api/products` - קבלת כל המוצרים הפעילים
- ✅ `GET /api/products/:id` - קבלת מוצר בודד
- ✅ `POST /api/orders` - יצירת הזמנה חדשה
- ✅ `GET /api/orders/:id` - קבלת פרטי הזמנה
- ✅ `GET /api/admin/products` - כל המוצרים (כולל לא פעילים)
- ✅ `POST /api/admin/products` - הוספת מוצר
- ✅ `PUT /api/admin/products/:id` - עדכון מוצר
- ✅ `DELETE /api/admin/products/:id` - מחיקה רכה
- ✅ `GET /api/admin/orders` - כל ההזמנות
- ✅ `PUT /api/admin/orders/:id` - עדכון סטטוס הזמנה

### 4. פאנל ניהול מקצועי
- ✅ דף ניהול ב-`/admin`
- ✅ טבלת מוצרים עם הוספה, עריכה ומחיקה
- ✅ טבלת הזמנות עם עדכון סטטוס תשלום
- ✅ ממשק אינטואיטיבי בעברית
- ✅ Modal לעריכת מוצרים

### 5. הכנה לשערי תשלום
- ✅ מסמך מפורט `PAYMENT_INTEGRATION.md`
- ✅ הוראות להוספת Tranzila, PayPal, Stripe
- ✅ דוגמאות קוד מוכנות
- ✅ הסבר על Webhooks

## 🌐 URLs

### סביבת פיתוח (Sandbox)
- **דף ראשי**: https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai
- **פאנל ניהול**: https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai/admin
- **API**: https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai/api/

### API Endpoints דוגמה
```bash
# קבלת כל המוצרים
curl https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai/api/products

# יצירת הזמנה
curl -X POST https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":{"name":"יוסי","email":"yossi@example.com"},"items":[{"id":1,"quantity":1,"price":149}],"total":149}'
```

### ייצור (לאחר פריסה)
- יוגדר לאחר פריסה ל-Cloudflare Pages

## 🗄️ מבנה מסד הנתונים

### טבלאות

**products** - מוצרים
```sql
id, name, description, price, category, image, digital_file_url, active, created_at, updated_at
```

**customers** - לקוחות
```sql
id, name, email, phone, created_at
```

**orders** - הזמנות
```sql
id, customer_id, total_amount, status, payment_method, payment_status, created_at, updated_at
```

**order_items** - פריטי הזמנה
```sql
id, order_id, product_id, quantity, price
```

**admin_users** - משתמשי ניהול
```sql
id, username, password_hash, email, created_at
```

### פעולות מסד נתונים

```bash
# הרצת מיגרציות מקומית
npm run db:migrate:local

# טעינת נתוני דוגמה
npm run db:seed

# איפוס מסד נתונים מקומי
npm run db:reset

# פתיחת קונסולת SQL מקומית
npm run db:console:local

# פעולות לייצור (דורש API token)
npm run db:migrate:prod
npm run db:console:prod
```

## 📦 התקנה ופיתוח

### התקנה ראשונית
```bash
cd /home/user/webapp
npm install
```

### פיתוח מקומי
```bash
# בניית הפרויקט
npm run build

# הגדרת מסד נתונים מקומי
npm run db:migrate:local
npm run db:seed

# הפעלת שרת פיתוח עם PM2
pm2 start ecosystem.config.cjs

# בדיקת שהשרת פועל
curl http://localhost:3000
```

### פקודות שימושיות
```bash
# רשימת שירותים
pm2 list

# צפייה בלוגים
pm2 logs webapp --nostream

# הפעלה מחדש
fuser -k 3000/tcp && pm2 restart webapp

# עצירה
pm2 delete webapp

# ניקוי פורט
npm run clean-port
```

## 🚀 פריסה ל-Cloudflare Pages

### צעדים לפריסה

#### 1. הכנה
```bash
# ודא שהפרויקט בנוי
npm run build
```

#### 2. הגדרת Cloudflare API Key
**חשוב**: לפני פריסה, יש להגדיר את מפתח ה-API של Cloudflare:
- עבור ל-Deploy tab בממשק
- הוסף את ה-Cloudflare API Token שלך
- חזור והפעל את הפקודה `setup_cloudflare_api_key`

#### 3. יצירת D1 Database בייצור
```bash
# צור את מסד הנתונים
npx wrangler d1 create ecocraft-production

# העתק את ה-database_id שהתקבל ל-wrangler.jsonc
```

#### 4. עדכון wrangler.jsonc
ודא ש-`database_id` מוגדר נכון ב-`wrangler.jsonc`:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ecocraft-production",
      "database_id": "your-actual-database-id"
    }
  ]
}
```

#### 5. הרצת מיגרציות לייצור
```bash
npm run db:migrate:prod
```

#### 6. יצירת פרויקט Cloudflare Pages
```bash
npx wrangler pages project create ecocraftdigital \
  --production-branch main \
  --compatibility-date 2025-11-01
```

#### 7. פריסה
```bash
npm run deploy:prod
```

#### 8. הגדרת Secrets (אם נדרש)
```bash
# לשערי תשלום
npx wrangler secret put STRIPE_SECRET_KEY --project-name ecocraftdigital
npx wrangler secret put PAYPAL_SECRET --project-name ecocraftdigital
```

## 💳 אינטגרציה עם שערי תשלום

ראה קובץ `PAYMENT_INTEGRATION.md` למדריך מפורט על:
- Tranzila (מומלץ לישראל)
- PayPal
- Stripe

דוגמה מהירה:
```typescript
// הוספת endpoint לתשלום ב-src/api.tsx
api.post('/payment/process', async (c) => {
  // לוגיקת תשלום כאן
})
```

## 🎨 התאמה אישית

### שינוי צבעים
ערוך את `public/static/styles.css`:
```css
:root {
  --primary-color: #10b981;    /* ירוק עיקרי */
  --secondary-color: #059669;  /* ירוק משני */
}
```

### הוספת מוצרים
1. **דרך פאנל ניהול** (`/admin`):
   - לחץ "הוסף מוצר"
   - מלא פרטים
   - שמור

2. **דרך SQL**:
```bash
npm run db:console:local
```
```sql
INSERT INTO products (name, description, price, category, image) 
VALUES ('מוצר חדש', 'תיאור', 99, 'קטגוריה', 'url');
```

## 📁 מבנה פרויקט

```
webapp/
├── src/
│   ├── index.tsx          # דף ראשי + דף admin
│   ├── api.tsx            # כל ה-API endpoints
│   └── renderer.tsx       # Renderer helpers
├── public/
│   └── static/
│       ├── app.js         # לוגיקת עגלה והזמנות
│       ├── admin.js       # לוגיקת פאנל ניהול
│       └── styles.css     # עיצוב מותאם
├── migrations/
│   └── 0001_initial_schema.sql  # סכמת DB
├── dist/                  # קבצים מקומפלים
├── seed.sql              # נתוני דוגמה
├── ecosystem.config.cjs   # הגדרות PM2
├── package.json           # תלויות
├── wrangler.jsonc         # הגדרות Cloudflare
├── PAYMENT_INTEGRATION.md # מדריך שערי תשלום
└── README.md              # מסמך זה
```

## 🎯 תכונות להוספה בעתיד

### 1. מערכת משתמשים
- הרשמה והתחברות
- פרופיל משתמש
- היסטוריית רכישות

### 2. הורדת קבצים
- מערכת הורדת מוצרים דיגיטליים
- קישורי הורדה ייחודיים
- הגבלת מספר הורדות

### 3. שליחת מיילים אוטומטית
- אישור הזמנה
- קישור להורדה
- חשבונית

### 4. ניתוח ודוחות
- Google Analytics
- מעקב אחר מכירות
- דוחות הכנסות

### 5. שיפורי UX
- חיפוש מוצרים
- סינון לפי קטגוריה
- מיון לפי מחיר
- רשימת משאלות

## 🔧 פתרון בעיות נפוצות

### הפורט 3000 תפוס
```bash
npm run clean-port
```

### מסד הנתונים ריק
```bash
npm run db:reset
```

### שגיאות build
```bash
rm -rf node_modules dist
npm install
npm run build
```

### בעיות PM2
```bash
pm2 delete all
pm2 start ecosystem.config.cjs
```

## 📊 מידע טכני

- **Framework**: Hono 4.10.4
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Build Tool**: Vite 6.4.1
- **CLI**: Wrangler 4.45.3
- **Styling**: Tailwind CSS (CDN)
- **Icons**: Font Awesome 6.4.0

## 📝 רישיונות

- קוד: כל הזכויות שמורות © 2025 ECOCRAFTDIGITAL
- תמונות: Unsplash (חינמי לשימוש)
- ספריות: ראה רישיונות ב-package.json

## 📞 תמיכה

לשאלות ותמיכה, פנה דרך:
- GitHub Issues
- דוא"ל: admin@ecocraftdigital.com

---

**גרסה**: 2.0.0  
**עדכון אחרון**: 2025-11-01  
**סטטוס**: ✅ פעיל ומוכן לייצור
