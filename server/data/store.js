import bcrypt from "bcryptjs";

/* In-memory data store — no real database (per assignment scope). */

function seedUsers() {
  return [
    {
      id: 1,
      email: "jane@example.com",
      passwordHash: bcrypt.hashSync("Passw0rd!", 8),
      role: "user",
    },
    {
      id: 2,
      email: "admin@queuesmart.com",
      passwordHash: bcrypt.hashSync("Passw0rd!", 8),
      role: "admin",
    },
  ];
}

function seedServices() {
  return [
    {
      id: 1,
      name: "General Checkup",
      description: "Routine physical exam and health assessment.",
      duration: 30,
      priority: "medium",
    },
    {
      id: 2,
      name: "Vaccination",
      description: "Scheduled immunizations and booster shots.",
      duration: 15,
      priority: "high",
    },
    {
      id: 3,
      name: "Lab Work",
      description: "Blood draw and diagnostic testing.",
      duration: 20,
      priority: "low",
    },
  ];
}

function seedNotifications() {
  return [
    {
      id: 1,
      userId: 1,
      type: "queue_joined",
      message: "You joined the queue for General Checkup.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      read: true,
    },
    {
      id: 2,
      userId: 1,
      type: "close_to_served",
      message: "You are almost up for General Checkup. Estimated wait: 10 minutes.",
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      read: false,
    },
  ];
}

function seedHistory() {
  return [
    {
      id: 1,
      userId: 1,
      serviceId: 3,
      joinedAt: "2026-07-08T10:00:00.000Z",
      servedAt: "2026-07-08T10:15:00.000Z",
      outcome: "served",
    },
    {
      id: 2,
      userId: 1,
      serviceId: 2,
      joinedAt: "2026-07-03T09:30:00.000Z",
      servedAt: "2026-07-03T09:45:00.000Z",
      outcome: "served",
    },
    {
      id: 3,
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-06-27T10:45:00.000Z",
      servedAt: null,
      outcome: "left_queue",
    },
  ];
}

function seedQueueEntries() {
  return [
    {
      id: 1,
      userId: 1,
      displayName: "Jane",
      serviceId: 1,
      priority: "medium",
      joinedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
  ];
}

export const db = {
  users: seedUsers(),
  services: seedServices(),
  sessions: new Map(), // token -> { userId }
  nextUserId: 3,
  nextServiceId: 4,
  notifications: seedNotifications(),
  nextNotificationId: 3,
  history: seedHistory(),
  nextHistoryId: 4,
  queueEntries: seedQueueEntries(),
  nextQueueEntryId: 2,
};

/** Resets the in-memory store to its seeded state — used between test runs. */
export function resetStore() {
  db.users = seedUsers();
  db.services = seedServices();
  db.sessions = new Map();
  db.nextUserId = 3;
  db.nextServiceId = 4;
  db.notifications = seedNotifications();
  db.nextNotificationId = 3;
  db.history = seedHistory();
  db.nextHistoryId = 4;
  db.queueEntries = seedQueueEntries();
  db.nextQueueEntryId = 2;
}
