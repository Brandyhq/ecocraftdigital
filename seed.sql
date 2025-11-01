-- Insert sample products
INSERT INTO products (name, description, price, category, image, digital_file_url, active) VALUES
('תבנית עיצוב לוגו מקצועי', 'קובץ AI/PSD לעיצוב לוגו מקצועי עם 20 וריאציות שונות', 149, 'עיצוב', 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=300&fit=crop', 'https://example.com/downloads/logo-template.zip', 1),
('ספר אלקטרוני - מדריך שיווק דיגיטלי', 'מדריך מקיף לשיווק דיגיטלי בעברית, 150 עמודים PDF', 99, 'חינוך', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=300&fit=crop', 'https://example.com/downloads/marketing-guide.pdf', 1),
('פלאגינים ל-WordPress', 'חבילת 10 פלאגינים מקצועיים לאתרי WordPress', 199, 'תוכנה', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop', 'https://example.com/downloads/wp-plugins.zip', 1),
('תבניות סושיאל מדיה', '50 תבניות עיצוב מוכנות לאינסטגרם ופייסבוק', 79, 'עיצוב', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop', 'https://example.com/downloads/social-templates.zip', 1),
('קורס וידאו - פיתוח אפליקציות', 'קורס מקיף בעברית לפיתוח אפליקציות מובייל, 30 שעות וידאו', 299, 'חינוך', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop', 'https://example.com/downloads/app-dev-course.zip', 1),
('מוזיקה ללא זכויות יוצרים', 'ספרייה של 100 רצועות מוזיקה לשימוש מסחרי', 249, 'מדיה', 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop', 'https://example.com/downloads/royalty-free-music.zip', 1);

-- Insert sample admin user (username: admin, password: admin123 - should be changed!)
-- Password hash is bcrypt hash of 'admin123'
INSERT INTO admin_users (username, password_hash, email) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin@ecocraftdigital.com');
