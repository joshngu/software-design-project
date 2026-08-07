-- Queue table
CREATE TABLE IF NOT EXISTS queues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL UNIQUE REFERENCES services(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  created_at TEXT NOT NULL
);

-- QueueEntry table
CREATE TABLE IF NOT EXISTS queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  join_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'served', 'canceled')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  display_name TEXT NOT NULL,
  FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
);

-- One active waiting entry per user per queue
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entries_unique_waiting_user
ON queue_entries(queue_id, user_id)
WHERE status = 'waiting';
