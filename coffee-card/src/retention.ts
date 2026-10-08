/**
 * Deletes cards with no activity (stamp/redeem/birthday) in the last `months` months,
 * and which were created before that. Their events go first because of the foreign key.
 * Returns the number of deleted cards.
 */
export async function purgeInactive(db: D1Database, months: number): Promise<number> {
  const cutoff = `-${Math.floor(months)} months`
  const inactive = `created_at < datetime('now', ?1)
    AND NOT EXISTS (SELECT 1 FROM card_events e WHERE e.card_id = cards.id AND e.created_at >= datetime('now', ?1))`
  const [, cards] = await db.batch([
    db.prepare(`DELETE FROM card_events WHERE card_id IN (SELECT id FROM cards WHERE ${inactive})`).bind(cutoff),
    db.prepare(`DELETE FROM cards WHERE ${inactive}`).bind(cutoff),
  ])
  return cards.meta.changes ?? 0
}
