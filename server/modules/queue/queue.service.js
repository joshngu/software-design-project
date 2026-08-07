import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { getServiceById, listServices } from "../services/services.service.js";
import { notifyCloseToServed, notifyQueueJoined } from "../notifications/notifications.service.js";
import { recordHistory } from "../history/history.service.js";
import { validateJoinPayload, validateLeavePayload, validateServiceIdParam } from "./queue.validation.js";

const PRIORITY_ORDER_SQL = `
  CASE qe.priority
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    ELSE 1
  END DESC,
  datetime(qe.join_time) ASC,
  qe.id ASC
`;

function getQueueByServiceId(serviceId) {
  return getDb()
    .prepare(
      `SELECT id, service_id AS serviceId, status, created_at AS createdDate
       FROM queues
       WHERE service_id = ?`
    )
    .get(Number(serviceId));
}

function getOrCreateQueueForService(serviceId) {
  const existing = getQueueByServiceId(serviceId);
  if (existing) return existing;

  const createdDate = new Date().toISOString();
  const insertResult = getDb()
    .prepare(
      `INSERT INTO queues (service_id, status, created_at)
       VALUES (?, 'open', ?)`
    )
    .run(Number(serviceId), createdDate);

  return {
    id: Number(insertResult.lastInsertRowid),
    serviceId: Number(serviceId),
    status: "open",
    createdDate,
  };
}

function listWaitingEntriesForQueue(queueId) {
  return getDb()
    .prepare(
      `SELECT
         qe.id,
         qe.queue_id AS queueId,
         qe.user_id AS userId,
         qe.position,
         qe.join_time AS joinTime,
         qe.status,
         qe.priority,
         qe.display_name AS displayName
       FROM queue_entries qe
       WHERE qe.queue_id = ? AND qe.status = 'waiting'
       ORDER BY qe.position ASC, qe.id ASC`
    )
    .all(queueId);
}

const reindexWaitingEntries = (queueId) => {
  const db = getDb();
  const updateQueueEntryPosition = db.prepare(
    `UPDATE queue_entries
     SET position = ?
     WHERE id = ?`
  );
  const waitingEntries = db
    .prepare(
      `SELECT qe.id
       FROM queue_entries qe
       WHERE qe.queue_id = ? AND qe.status = 'waiting'
       ORDER BY ${PRIORITY_ORDER_SQL}`
    )
    .all(queueId);

  waitingEntries.forEach((entry, index) => {
    updateQueueEntryPosition.run(index + 1, entry.id);
  });
};

function readQueueEntryById(entryId) {
  return getDb()
    .prepare(
      `SELECT
         qe.id,
         qe.queue_id AS queueId,
         qe.user_id AS userId,
         qe.position,
         qe.join_time AS joinTime,
         qe.status,
         qe.priority,
         qe.display_name AS displayName
       FROM queue_entries qe
       WHERE qe.id = ?`
    )
    .get(entryId);
}

function getEstimatedWaitMinutes(service, entriesAheadCount) {
  return entriesAheadCount * Number(service.duration);
}

function toPublicQueueEntry(entry, service, queue) {
  return {
    id: entry.id,
    userId: entry.userId,
    displayName: entry.displayName,
    queueId: queue.id,
    queueStatus: queue.status,
    queueCreatedDate: queue.createdDate,
    serviceId: entry.serviceId,
    serviceName: service.name,
    status: entry.status,
    priority: entry.priority,
    joinTime: entry.joinTime,
    joinedAt: entry.joinTime, // Backward-compatible frontend field.
    position: entry.position,
    expectedDuration: Number(service.duration),
    estimatedWaitMinutes: getEstimatedWaitMinutes(service, entry.position - 1),
  };
}

function assertServiceExists(serviceId) {
  const service = getServiceById(serviceId);
  if (!service) {
    throw new ApiError(404, "Service not found.");
  }
  return service;
}

function deriveDisplayName(user) {
  if (typeof user.email === "string" && user.email.includes("@")) {
    return user.email.split("@")[0];
  }
  return `User ${user.id}`;
}

export function listQueueForService(serviceId) {
  const errors = validateServiceIdParam(serviceId);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const service = assertServiceExists(serviceId);
  const queue = getOrCreateQueueForService(service.id);
  reindexWaitingEntries(queue.id);
  const waitingEntries = listWaitingEntriesForQueue(queue.id).map((entry) => ({
    ...entry,
    serviceId: queue.serviceId,
  }));

  return waitingEntries.map((entry) => toPublicQueueEntry(entry, service, queue));
}

export function listQueueSummary() {
  return listServices().map((service) => {
    const queue = getOrCreateQueueForService(service.id);
    const waitingCountResult = getDb()
      .prepare(
        `SELECT COUNT(*) AS count
         FROM queue_entries
         WHERE queue_id = ? AND status = 'waiting'`
      )
      .get(queue.id);
    const queueLength = Number(waitingCountResult.count);
    return {
      queueId: queue.id,
      serviceId: service.id,
      serviceName: service.name,
      status: queue.status,
      createdDate: queue.createdDate,
      queueLength,
      estimatedWaitForNewJoinMinutes: getEstimatedWaitMinutes(service, queueLength),
    };
  });
}

export function joinQueue({ user, serviceId, priority, displayName }) {
  const payloadErrors = validateJoinPayload({ serviceId, priority, displayName });
  if (Object.keys(payloadErrors).length > 0) {
    throw new ApiError(400, "Validation failed", payloadErrors);
  }

  const service = assertServiceExists(serviceId);
  const queue = getOrCreateQueueForService(service.id);
  if (queue.status !== "open") {
    throw new ApiError(409, "Queue is currently closed.");
  }

  const alreadyQueued = getDb()
    .prepare(
      `SELECT id
       FROM queue_entries
       WHERE queue_id = ? AND user_id = ? AND status = 'waiting'`
    )
    .get(queue.id, user.id);

  if (alreadyQueued) {
    throw new ApiError(409, "You are already in this queue.");
  }

  const queueLengthResult = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM queue_entries
       WHERE queue_id = ? AND status = 'waiting'`
    )
    .get(queue.id);
  const nextPosition = Number(queueLengthResult.count) + 1;
  const joinTime = new Date().toISOString();
  const insertResult = getDb()
    .prepare(
      `INSERT INTO queue_entries (
         queue_id, user_id, position, join_time, status, priority, display_name
       ) VALUES (?, ?, ?, ?, 'waiting', ?, ?)`
    )
    .run(
      queue.id,
      user.id,
      nextPosition,
      joinTime,
      priority || service.priority || "medium",
      displayName?.trim() || deriveDisplayName(user)
    );

  const entryId = Number(insertResult.lastInsertRowid);
  reindexWaitingEntries(queue.id);
  const entry = {
    ...readQueueEntryById(entryId),
    serviceId: queue.serviceId,
  };
  notifyQueueJoined(user.id, service.name);
  const estimatedWaitMinutes = getEstimatedWaitMinutes(service, entry.position - 1);
  if (estimatedWaitMinutes <= Number(service.duration)) {
    notifyCloseToServed(user.id, service.name, estimatedWaitMinutes);
  }

  return toPublicQueueEntry(entry, service, queue);
}

export function leaveQueue({ userId, serviceId }) {
  const payloadErrors = validateLeavePayload({ serviceId });
  if (Object.keys(payloadErrors).length > 0) {
    throw new ApiError(400, "Validation failed", payloadErrors);
  }

  const service = assertServiceExists(serviceId);
  const queue = getQueueByServiceId(service.id);
  if (!queue) {
    throw new ApiError(404, "Queue entry not found for this user and service.");
  }
  const entry = getDb()
    .prepare(
      `SELECT
         qe.id,
         qe.queue_id AS queueId,
         qe.user_id AS userId,
         qe.position,
         qe.join_time AS joinTime,
         qe.priority,
         qe.display_name AS displayName
       FROM queue_entries qe
       WHERE qe.queue_id = ? AND qe.user_id = ? AND qe.status = 'waiting'`
    )
    .get(queue.id, userId);

  if (!entry) {
    throw new ApiError(404, "Queue entry not found for this user and service.");
  }

  getDb()
    .prepare(
      `UPDATE queue_entries
       SET status = 'canceled'
       WHERE id = ?`
    )
    .run(entry.id);
  reindexWaitingEntries(queue.id);

  recordHistory({
    userId: entry.userId,
    serviceId: service.id,
    joinedAt: entry.joinTime,
    servedAt: null,
    outcome: "left_queue",
  });

  return {
    id: entry.id,
    queueId: queue.id,
    userId: entry.userId,
    serviceId: service.id,
    serviceName: service.name,
    priority: entry.priority,
    joinTime: entry.joinTime,
    joinedAt: entry.joinTime,
    status: "canceled",
    outcome: "left_queue",
  };
}

export function serveNextUser(serviceId) {
  const errors = validateServiceIdParam(serviceId);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const service = assertServiceExists(serviceId);
  const queue = getQueueByServiceId(service.id);
  if (!queue) {
    throw new ApiError(404, "No users are currently waiting in this queue.");
  }

  reindexWaitingEntries(queue.id);
  const nextEntry = getDb()
    .prepare(
      `SELECT
         qe.id,
         qe.user_id AS userId,
         qe.join_time AS joinTime,
         qe.priority,
         qe.display_name AS displayName
       FROM queue_entries qe
       WHERE qe.queue_id = ? AND qe.status = 'waiting'
       ORDER BY qe.position ASC, qe.id ASC
       LIMIT 1`
    )
    .get(queue.id);

  if (!nextEntry) {
    throw new ApiError(404, "No users are currently waiting in this queue.");
  }

  const servedAt = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE queue_entries
       SET status = 'served'
       WHERE id = ?`
    )
    .run(nextEntry.id);
  reindexWaitingEntries(queue.id);

  recordHistory({
    userId: nextEntry.userId,
    serviceId: service.id,
    joinedAt: nextEntry.joinTime,
    servedAt,
    outcome: "served",
  });

  const remainingNextEntry = getDb()
    .prepare(
      `SELECT
         qe.user_id AS userId
       FROM queue_entries qe
       WHERE qe.queue_id = ? AND qe.status = 'waiting'
       ORDER BY qe.position ASC, qe.id ASC
       LIMIT 1`
    )
    .get(queue.id);
  if (remainingNextEntry) {
    notifyCloseToServed(remainingNextEntry.userId, service.name, 0);
  }

  return {
    id: nextEntry.id,
    queueId: queue.id,
    userId: nextEntry.userId,
    displayName: nextEntry.displayName,
    serviceId: service.id,
    serviceName: service.name,
    joinTime: nextEntry.joinTime,
    servedAt,
    status: "served",
  };
}

export function listQueuesForUser(userId) {
  const waitingRows = getDb()
    .prepare(
      `SELECT
         qe.id,
         qe.queue_id AS queueId,
         qe.user_id AS userId,
         qe.position,
         qe.join_time AS joinTime,
         qe.status,
         qe.priority,
         qe.display_name AS displayName,
         q.service_id AS serviceId,
         q.status AS queueStatus,
         q.created_at AS queueCreatedDate
       FROM queue_entries qe
       JOIN queues q ON q.id = qe.queue_id
       WHERE qe.user_id = ? AND qe.status = 'waiting'
       ORDER BY qe.position ASC, qe.id ASC`
    )
    .all(userId);

  return waitingRows
    .map((entry) => {
      const service = getServiceById(entry.serviceId);
      if (!service) return null;
      return toPublicQueueEntry(
        entry,
        service,
        {
          id: entry.queueId,
          serviceId: entry.serviceId,
          status: entry.queueStatus,
          createdDate: entry.queueCreatedDate,
        }
      );
    })
    .filter(Boolean)
    .sort((a, b) => a.estimatedWaitMinutes - b.estimatedWaitMinutes || a.id - b.id);
}
