import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

import { resetSessions } from "./sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = path.join(__dirname, "queuesmart.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS user_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES user_credentials(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high'))
  );

  CREATE TABLE IF NOT EXISTS queues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queue_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    join_time TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled')),
    display_name TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high'))
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    served_at TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('served', 'left_queue', 'no_show'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('queue_joined', 'close_to_served')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'viewed')) DEFAULT 'sent'
);
`;

function migrateLegacyQueueSchema(instance) {
  const queueEntryCols = instance.prepare("PRAGMA table_info(queue_entries)").all();
  const hasQueueId = queueEntryCols.some((col) => col.name === "queue_id");
  if (hasQueueId || queueEntryCols.length === 0) return;

  instance.exec("ALTER TABLE queue_entries RENAME TO queue_entries_legacy");
  instance.exec(`
    CREATE TABLE queue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position > 0),
      join_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled')),
      display_name TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entries_unique_waiting_user
    ON queue_entries(queue_id, user_id)
    WHERE status = 'waiting';
  `);

  const selectLegacyEntries = instance.prepare(`
    SELECT id, user_id, service_id, display_name, priority, joined_at
    FROM queue_entries_legacy
    ORDER BY service_id ASC, datetime(joined_at) ASC, id ASC
  `);
  const selectQueueByService = instance.prepare("SELECT id FROM queues WHERE service_id = ?");
  const insertQueue = instance.prepare("INSERT INTO queues (service_id, status, created_at) VALUES (?, 'open', ?)");
  const countWaiting = instance.prepare("SELECT COUNT(*) AS count FROM queue_entries WHERE queue_id = ? AND status = 'waiting'");
  const insertEntry = instance.prepare(`
    INSERT INTO queue_entries (queue_id, user_id, position, join_time, status, display_name, priority)
    VALUES (?, ?, ?, ?, 'waiting', ?, ?)
  `);

  for (const legacy of selectLegacyEntries.all()) {
    let queue = selectQueueByService.get(legacy.service_id);
    if (!queue) {
      const queueResult = insertQueue.run(legacy.service_id, legacy.joined_at);
      queue = { id: Number(queueResult.lastInsertRowid) };
    }
    const nextPosition = Number(countWaiting.get(queue.id).count) + 1;
    insertEntry.run(queue.id, legacy.user_id, nextPosition, legacy.joined_at, legacy.display_name, legacy.priority);
  }

  instance.exec("DROP TABLE queue_entries_legacy");
}

function applySchema(instance) {
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  migrateLegacyQueueSchema(instance);
  // Created last, once queue_entries is guaranteed to be in its current shape
  // (freshly created above, or rebuilt by migrateLegacyQueueSchema) — creating
  // it any earlier would fail against a pre-migration legacy table.
  instance.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entries_unique_waiting_user
    ON queue_entries(queue_id, user_id)
    WHERE status = 'waiting';
  `);
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

/** Seeds demo users, profiles, and services — only runs against an empty database. */
function seedCore(instance) {
  const { count } = instance.prepare("SELECT COUNT(*) AS count FROM user_credentials").get();
  if (count > 0) return false;

  const insertUser = instance.prepare(
    "INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)"
  );
  const insertProfile = instance.prepare(
    "INSERT INTO user_profiles (user_id, full_name, email, phone) VALUES (?, ?, ?, ?)"
  );

  const jane = insertUser.run("jane@example.com", bcrypt.hashSync("Passw0rd!", 8), "user");
  insertProfile.run(jane.lastInsertRowid, "Jane Doe", "jane@example.com", null);

  const admin = insertUser.run("admin@queuesmart.com", bcrypt.hashSync("Passw0rd!", 8), "admin");
  insertProfile.run(admin.lastInsertRowid, "Admin User", "admin@queuesmart.com", null);

  const insertService = instance.prepare(
    "INSERT INTO services (name, description, duration, priority) VALUES (?, ?, ?, ?)"
  );
  insertService.run("General Checkup", "Routine physical exam and health assessment.", 30, "medium");
  insertService.run("Vaccination", "Scheduled immunizations and booster shots.", 15, "high");
  insertService.run("Lab Work", "Blood draw and diagnostic testing.", 20, "low");

  return true;
}

/** Seeds sample activity (queue entry, notifications, history) for the demo "jane" user. */
function seedActivity(instance) {
  const queueCreatedAt = isoMinutesAgo(20);
  const queue = instance
    .prepare("INSERT INTO queues (service_id, status, created_at) VALUES (?, 'open', ?)")
    .run(1, queueCreatedAt);
  instance
    .prepare(
      `INSERT INTO queue_entries (
        queue_id, user_id, position, join_time, status, display_name, priority
      ) VALUES (?, ?, ?, ?, 'waiting', ?, ?)`
    )
    .run(queue.lastInsertRowid, 1, 1, isoMinutesAgo(12), "Jane", "medium");

  const insertNotification = instance.prepare(
    "INSERT INTO notifications (user_id, type, message, created_at, status) VALUES (?, ?, ?, ?, ?)"
  );
  insertNotification.run(1, "queue_joined", "You joined the queue for General Checkup.", isoMinutesAgo(60), "viewed");
  insertNotification.run(
    1,
    "close_to_served",
    "You are almost up for General Checkup. Estimated wait: 10 minutes.",
    isoMinutesAgo(5),
    "sent"
  );

  const insertHistory = instance.prepare(
    "INSERT INTO history (user_id, service_id, joined_at, served_at, outcome) VALUES (?, ?, ?, ?, ?)"
  );
  insertHistory.run(1, 3, "2026-07-08T10:00:00.000Z", "2026-07-08T10:15:00.000Z", "served");
  insertHistory.run(1, 2, "2026-07-03T09:30:00.000Z", "2026-07-03T09:45:00.000Z", "served");
  insertHistory.run(1, 1, "2026-06-27T10:45:00.000Z", null, "left_queue");
}

let db = null;

/** Opens (or creates) the file-backed database used by the running server. */
export function initDb(filePath = DEFAULT_DB_PATH) {
  db = new Database(filePath);
  applySchema(db);
  const seeded = seedCore(db);
  if (seeded) seedActivity(db);
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

/** Resets to a fresh in-memory database — used between test runs. */
export function resetTestDb({ seedActivity: shouldSeedActivity = true } = {}) {
  if (db) db.close();
  db = new Database(":memory:");
  applySchema(db);
  seedCore(db);
  if (shouldSeedActivity) seedActivity(db);
  resetSessions();
  return db;
}
