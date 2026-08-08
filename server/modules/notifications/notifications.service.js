import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { validateNotification, validateNotificationId } from "./notifications.validation.js";

/*
 * Notification Module.
 * Backend logic to trigger notifications when a user joins a queue or is
 * close to being served. Persisted in the `notifications` table (no real
 * email/SMS delivery — the frontend polls/reads this via the API).
 */

function toPublicNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
     status: row.status,
  };
}

export function notify(userId, type, message) {
  const errors = validateNotification({ userId, type, message });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO notifications (user_id, type, message, created_at, status) VALUES (?, ?, ?, ?,'sent' )")
    .run(userId, type, message, createdAt);

  const row = db.prepare("SELECT * FROM notifications WHERE id = ?").get(result.lastInsertRowid);
  return toPublicNotification(row);
}

/** Called when a user joins a queue for a service. */
export function notifyQueueJoined(userId, serviceName) {
  return notify(userId, "queue_joined", `You joined the queue for ${serviceName}.`);
}

/** Called when a user's estimated wait drops to/below the "almost up" threshold. */
export function notifyCloseToServed(userId, serviceName, estimatedWaitMinutes) {
  return notify(
    userId,
    "close_to_served",
    `You are almost up for ${serviceName}. Estimated wait: ${estimatedWaitMinutes} minutes.`
  );
}

export function listNotificationsForUser(userId) {
  return getDb()
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(userId)
    .map(toPublicNotification);
}

export function markNotificationRead(notificationId, userId) {
  const errors = validateNotificationId(notificationId);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM notifications WHERE id = ?").get(Number(notificationId));
  if (!row || row.user_id !== userId) {
    return null;
  }

  db.prepare("UPDATE notifications SET status = 'viewed' WHERE id = ?").run(row.id);
  return toPublicNotification({ ...row, status:"viewed"});
}
