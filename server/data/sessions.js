/* In-memory bearer-token sessions. Ephemeral by nature (tied to process
 * uptime), so unlike the rest of the data layer these are kept out of the
 * database rather than persisted. */

export const sessions = new Map(); // token -> userId

export function resetSessions() {
  sessions.clear();
}
