-- Birthday is stored as "MM-DD" only (no year) to keep the personal data minimal.
ALTER TABLE cards ADD COLUMN birthday TEXT;
ALTER TABLE cards ADD COLUMN birthday_reward_year INTEGER;
-- SQLite cannot alter a CHECK; rebuild card_events to allow kind = 'birthday'.
CREATE TABLE card_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  kind TEXT NOT NULL CHECK (kind IN ('stamp','redeem','birthday')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO card_events_new (id, card_id, kind, created_at) SELECT id, card_id, kind, created_at FROM card_events;
DROP TABLE card_events;
ALTER TABLE card_events_new RENAME TO card_events;
CREATE INDEX idx_events_card ON card_events(card_id, created_at);
