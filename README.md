# ECOCRAFTDIGITAL - חנות מוצרים דיגיטליים

## סקירה כללית

**ECOCRAFTDIGITAL** היא פלטפורמה למכירת מוצרים דיגיטליים איכותיים לקהל הישראלי. האתר מציע ממשק נוח, מודרני ומותאם לעברית עם עגלת קניות מתקדמת.

## תכונות מושלמות ✅

### 1. ממשק משתמש
- ✅ עיצוב מודרני ומותאם לעברית (RTL)
- ✅ ממשק רספונסיבי למובייל וטאבלט
- ✅ אנימציות חלקות ואינטראקטיביות
- ✅ אייקונים ועיצוב עם Tailwind CSS ו-Font Awesome

### 2. קטלוג מוצרים
- ✅ 6 מוצרי דוגמה (תבניות עיצוב, קורסים, ספרים דיגיטליים)
- ✅ תמונות ממאגרי תמונות חינמיים
- ✅ תיאורים, מחירים וקטגוריות
- ✅ כרטיסי מוצרים אינטראקטיביים עם אפקט hover

### 3. עגלת קניות
- ✅ הוספה והסרה של מוצרים
- ✅ עדכון כמויות
- ✅ חישוב סכום כולל אוטומטי
- ✅ שמירת העגלה ב-localStorage
- ✅ תג מונה פריטים בעגלה

### 4. תהליך רכישה
- ✅ טופס פרטי לקוח (שם, אימייל, טלפון)
- ✅ הצגת סיכום הזמנה
- ✅ הודעות הצלחה
- ✅ ניקוי עגלה לאחר הזמנה

### 5. סקשנים נוספים
- ✅ Hero section עם קריאה לפעולה
- ✅ סקשן יתרונות (הורדה מיידית, תשלום מאובטח, תמיכה 24/7)
- ✅ סקשן אודות
- ✅ Footer עם קישורים לרשתות חברתיות

## URLs

### סביבת Sandbox (פיתוח)
- **דף ראשי**: https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai
- **API מוצרים**: https://3000-iav8deovnvnd7puxrzodo-82b888ba.sandbox.novita.ai/api/products

### ייצור (לאחר deploy)
- יוגדר לאחר פריסה ל-Cloudflare Pages

## ארכיטקטורה טכנית

### מבנה נתונים
```javascript
Product {
  id: number,
  name: string,
  description: string,
  price: number,
  category: string,
  image: string (URL)
}

CartItem {
  ...Product,
  quantity: number
}
```

### אחסון
- **Frontend State**: localStorage לשמירת עגלת קניות
- **עתידי**: אפשר להוסיף Cloudflare D1 לניהול מוצרים ומשתמשים

### טכנולוגיות
- **Backend**: Hono Framework על Cloudflare Workers
- **Frontend**: HTML, CSS, JavaScript vanilla
- **Styling**: Tailwind CSS (CDN)
- **Icons**: Font Awesome
- **Build**: Vite
- **Deploy**: Cloudflare Pages

## מדריך שימוש

### למבקרים באתר:

1. **עיון במוצרים**
   - גלול למטה לסקשן "המוצרים שלנו"
   - לחץ על כרטיסי מוצרים לצפייה בפרטים

2. **הוספה לעגלה**
   - לחץ על כפתור "הוסף לעגלה" בכל מוצר
   - תקבל הודעת אישור

3. **צפייה בעגלה**
   - לחץ על אייקון העגלה בתפריט העליון
   - עדכן כמויות או הסר מוצרים

4. **השלמת רכישה**
   - לחץ "המשך לתשלום"
   - מלא פרטים (שם, אימייל, טלפון)
   - שלח הזמנה

5. **לאחר ההזמנה**
   - תקבל הודעת הצלחה
   - העגלה תתרוקן אוטומטית

## תכונות שטרם יושמו 🚧

### 1. שער תשלום
- ❌ אינטגרציה עם PayPal/Stripe/Tranzila
- ❌ תשלום בכרטיס אשראי
- ❌ תשלום ב-PayPal

### 2. ניהול מוצרים
- ❌ פאנל ניהול לבעל האתר
- ❌ הוספה/עריכה/מחיקה של מוצרים
- ❌ העלאת תמונות למוצרים
- ❌ ניהול קטגוריות

### 3. מערכת משתמשים
- ❌ הרשמה והתחברות
- ❌ פרופיל משתמש
- ❌ היסטוריית הזמנות
- ❌ רשימת משאלות

### 4. הורדת קבצים
- ❌ מערכת הורדת מוצרים דיגיטליים
- ❌ הפקת קישורי הורדה ייחודיים
- ❌ הגבלת מספר הורדות

### 5. שליחת מיילים
- ❌ אישור הזמנה למייל
- ❌ קישור להורדת המוצרים
- ❌ חשבונית עסקה

### 6. ניתוח ודוחות
- ❌ Google Analytics
- ❌ מעקב אחר מכירות
- ❌ דוחות הכנסות

## צעדים מומלצים לפיתוח

### עדיפות 1: שער תשלום
```bash
# הוסף אינטגרציה עם Stripe או Tranzila
# צור API endpoints לטיפול בתשלומים
```

### עדיפות 2: מסד נתונים
```bash
# הגדר Cloudflare D1 Database
cd /home/user/webapp
npx wrangler d1 create ecocraft-db

# צור טבלאות: products, orders, users
```

### עדיפות 3: אימייל
```bash
# הוסף SendGrid/Mailgun לשליחת מיילים אוטומטיים
```

### עדיפות 4: פאנל ניהול
```bash
# צור דפי admin להוספת ועריכת מוצרים
```

## פריסה (Deployment)

### פיתוח מקומי
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
```

### פריסה ל-Cloudflare Pages
```bash
# הגדר Cloudflare API Token
# קרא setup_cloudflare_api_key

# פרוס
npm run build
npx wrangler pages deploy dist --project-name ecocraftdigital
```

## מבנה פרויקט

```
webapp/
├── src/
│   ├── index.tsx          # נקודת כניסה ראשית, HTML של האתר
│   └── renderer.tsx       # Renderer helpers
├── public/
│   └── static/
│       ├── app.js         # לוגיקת Frontend (עגלה, מוצרים)
│       └── styles.css     # עיצוב CSS מותאם אישית
├── dist/                  # קבצים מקומפלים (לא ב-git)
├── ecosystem.config.cjs   # הגדרות PM2
├── package.json           # תלויות ו-scripts
├── vite.config.ts         # הגדרות Vite
├── wrangler.jsonc         # הגדרות Cloudflare
└── README.md              # תיעוד זה
```

## סטטוס הפרויקט

- **סטטוס**: ✅ פעיל בסביבת פיתוח
- **גרסה**: 1.0.0
- **עדכון אחרון**: 2025-11-01
- **טכנולוגיות**: Hono + Cloudflare Workers + Tailwind CSS

## רישיון
כל הזכויות שמורות © 2025 ECOCRAFTDIGITAL
