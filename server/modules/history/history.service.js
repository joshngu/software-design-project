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
/**
 * Smart Feature: Adaptive Wait-Time Estimation.
 *
 * Computes the average real minutes-to-serve for a service, based on its
 * most recent completed history entries. This lets queue wait
 * estimates reflect how the service is actually performing rather than a
 * fixed -- the estimate gets more accurate as more
 * people are served.
 *
 * Returns null when there isn't enough completed history yet, so callers can fall back to the service's static
 * expected duration until real data is available.
 *
 * @param {number} serviceId
 * @param {object} [options]
 * @param {number} [options.minSamples=3] - minimum completed entries required to trust the average
 * @param {number} [options.sampleSize=20] - how many recent entries to average over
 * @returns {number|null} average minutes per user, or null if not enough data
 */
export function getAverageServiceDurationMinutes(
  serviceId,
  { minSamples = 3, sampleSize = 20 } = {}
) {
  const rows = getDb()
    .prepare(
      `SELECT joined_at, served_at
       FROM history
       WHERE service_id = ? AND outcome = 'served' AND served_at IS NOT NULL
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(Number(serviceId), sampleSize);

  if (rows.length < minSamples) {
    return null;
  }

  const totalMinutes = rows.reduce((sum, row) => {
    const joinedMs = new Date(row.joined_at).getTime();
    const servedMs = new Date(row.served_at).getTime();
    return sum + (servedMs - joinedMs) / 60000;
  }, 0);

  return totalMinutes / rows.length;
}