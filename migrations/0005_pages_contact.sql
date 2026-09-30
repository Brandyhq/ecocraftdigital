-- Editable content pages (FAQ, legal drafts, custom pages) and contact-form messages.
CREATE TABLE pages (
  slug TEXT PRIMARY KEY,                       -- faq, terms, privacy, refunds, or any custom slug
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',               -- light markup: "## heading", "- bullet", blank line = new paragraph
  published INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  order_ref TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contact_messages_email ON contact_messages(email, created_at);

-- FAQ: published, only statements that are true of how the store works.
INSERT INTO pages (slug, title, body, published) VALUES ('faq', 'שאלות נפוצות', '## איך קונים?
בוחרים מוצר, מוסיפים לעגלה ומסיימים הזמנה עם שם ואימייל. אחר כך עוברים לדף תשלום מאובטח.

## האם המוצרים פיזיים?
לא. כל המוצרים דיגיטליים לחלוטין, ולכן אין משלוח ואין המתנה לדואר.

## איך מקבלים את המוצר?
אחרי שהתשלום מאושר מתקבל קישור הורדה אישי. שמרו אותו — הוא שלכם ופועל גם בפעם הבאה שתרצו להוריד שוב.

## עם אילו אפליקציות המוצרים עובדים?
בעמוד של כל מוצר מפורט באילו אפליקציות ופורמטים הוא מתאים (למשל GoodNotes). אפשר לעיין בתיאור לפני הרכישה.

## לא קיבלתי את הקובץ או שמשהו לא עובד. מה עושים?
פנו אלינו דרך עמוד "צור קשר", כתבו את מספר ההזמנה, ונטפל בזה.', 1);

-- Legal pages: DRAFTS, unpublished until the owner fills the [להשלים] parts and has them reviewed.
INSERT INTO pages (slug, title, body, published) VALUES ('terms', 'תקנון ותנאי שימוש', '> טיוטה לעריכה ולבדיקה משפטית — לא לפרסום לפני השלמת הפרטים.

## כללי
האתר {{siteUrl}} מופעל על ידי {{businessName}} ({{businessId}}). השימוש באתר וברכישה בו כפופים לתנאים אלה. פרטי קשר: {{contactEmail}}.

## המוצרים
כל המוצרים באתר הם מוצרים דיגיטליים המועברים בהורדה. אין משלוח פיזי. תיאור כל מוצר מופיע בעמוד המוצר; ייתכנו הבדלי תצוגה בין מכשירים ואפליקציות.

## מחירים ותשלום
המחירים באתר הם בשקלים חדשים [להשלים: כולל / לא כולל מע"מ]. התשלום מתבצע בדף תשלום מאובטח של חברת הסליקה. פרטי כרטיס האשראי אינם נשמרים באתר.

## אספקה
לאחר אישור התשלום מתקבל קישור הורדה אישי. [להשלים: מגבלות על מספר הורדות, אם קיימות.]

## זכויות יוצרים ורישיון שימוש
[להשלים: היקף השימוש המותר — למשל שימוש אישי בלבד, איסור על שיתוף והפצה חוזרת או מכירה.] כל הזכויות במוצרים שמורות ל{{businessName}}.

## ביטולים והחזרים
ראו את עמוד "ביטולים והחזרים".

## שינוי תנאים ודין
{{businessName}} רשאית לעדכן תנאים אלה מעת לעת. [להשלים: הדין החל וסמכות השיפוט.]', 0);

INSERT INTO pages (slug, title, body, published) VALUES ('privacy', 'מדיניות פרטיות', '> טיוטה לעריכה ולבדיקה משפטית — לא לפרסום לפני השלמת הפרטים.

## איזה מידע נאסף
- בהזמנה: שם, כתובת אימייל, טלפון (לא חובה) ופרטי ההזמנה.
- בהרשמה לניוזלטר: כתובת אימייל, ואישור קבלת דיוור.
- בטופס יצירת קשר: שם, אימייל והודעה.
- בדפדפן נשמרים באופן מקומי בלבד תוכן העגלה והעדפת מצב תצוגה (בהיר/כהה).

## למה משתמשים במידע
לעיבוד הזמנות ומסירת המוצרים, למענה לפניות, ולשליחת דיוור — רק למי שאישרה זאת, ואפשר להסיר את עצמך בכל עת.

## תשלומים
התשלום מתבצע אצל חברת סליקה חיצונית. פרטי כרטיס האשראי אינם נשמרים אצלנו.

## העברת מידע לצדדים שלישיים
[להשלים: פירוט ספקים שמקבלים מידע, למשל חברת הסליקה ושירות הדיוור.] איננו מוכרים מידע אישי.

## זכויות שלך
בהתאם לחוק הגנת הפרטיות, ניתן לפנות אלינו בבקשה לעיין במידע, לתקן או למחוק אותו: {{contactEmail}}.

## עוגיות ומעקב
[להשלים: האם משתמשים בכלי סטטיסטיקה או פרסום.]', 0);

INSERT INTO pages (slug, title, body, published) VALUES ('refunds', 'ביטולים והחזרים', '> טיוטה לעריכה ולבדיקה משפטית — לא לפרסום לפני השלמת הפרטים.

## מוצרים דיגיטליים
כל המוצרים באתר הם דיגיטליים ומועברים בהורדה מיידית.

## מדיניות ביטול והחזר
[להשלים לפי ייעוץ משפטי: באילו מקרים ניתן לבטל עסקה ולקבל החזר, בתוך כמה זמן, ומה לגבי מוצר שכבר הורד.]

## תקלה במוצר
אם קיבלתם קובץ פגום או שלא ניתן לפתוח — פנו אלינו עם מספר ההזמנה ונפתור את זה או נחזיר את התשלום.

## איך פונים
דרך עמוד "צור קשר" או ב-{{contactEmail}}.', 0);

-- Contact address for the storefront (editable later in the back office).
UPDATE site_settings SET value = json_set(value, '$.contactEmail', 'ecocraftdigital@gmail.com', '$.contactPhone', '0507148144', '$.instagramUrl', 'https://www.instagram.com/michalecocraftdigital/') WHERE key = 'design';
