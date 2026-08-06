import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { validateHistoryEntry } from "./history.validation.js";

/*
 * History Module.
 * Tracks queue participation history for users, persisted in the
 * `history` table.
 */

function toPublicHistoryEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    serviceId: row.service_id,
    joinedAt: row.joined_at,
    servedAt: row.served_at,
    outcome: row.outcome,
  };
}

export function recordHistory({ userId, serviceId, joinedAt, servedAt = null, outcome }) {
  const errors = validateHistoryEntry({ userId, serviceId, joinedAt, servedAt, outcome });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO history (user_id, service_id, joined_at, served_at, outcome) VALUES (?, ?, ?, ?, ?)")
    .run(userId, Number(serviceId), joinedAt, servedAt, outcome);

  const row = db.prepare("SELECT * FROM history WHERE id = ?").get(result.lastInsertRowid);
  return toPublicHistoryEntry(row);
}

export function listHistoryForUser(userId) {
  return getDb()
    .prepare("SELECT * FROM history WHERE user_id = ? ORDER BY joined_at DESC, id DESC")
    .all(userId)
    .map(toPublicHistoryEntry);
}
