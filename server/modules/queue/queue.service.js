import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { getServiceById, listServices } from "../services/services.service.js";
import { notifyCloseToServed, notifyQueueJoined } from "../notifications/notifications.service.js";
import { recordHistory } from "../history/history.service.js";
import { validateJoinPayload, validateLeavePayload, validateServiceIdParam } from "./queue.validation.js";

const PRIORITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

function toQueueEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    serviceId: row.service_id,
    priority: row.priority,
    joinedAt: row.joined_at,
  };
}

function compareQueueEntries(a, b) {
  const priorityDelta = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
  if (priorityDelta !== 0) return priorityDelta;
  const joinedDelta = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  if (joinedDelta !== 0) return joinedDelta;
  return a.id - b.id;
}

function getOrderedQueueForService(serviceId) {
  return getDb()
    .prepare("SELECT * FROM queue_entries WHERE service_id = ?")
    .all(Number(serviceId))
    .map(toQueueEntry)
    .sort(compareQueueEntries);
}

function getEstimatedWaitMinutes(service, entriesAheadCount) {
  return entriesAheadCount * Number(service.duration);
}

function toPublicQueueEntry(entry, service, index) {
  return {
    id: entry.id,
    userId: entry.userId,
    displayName: entry.displayName,
    serviceId: entry.serviceId,
    serviceName: service.name,
    priority: entry.priority,
    joinedAt: entry.joinedAt,
    position: index + 1,
    expectedDuration: Number(service.duration),
    estimatedWaitMinutes: getEstimatedWaitMinutes(service, index),
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
  const orderedQueue = getOrderedQueueForService(service.id);

  return orderedQueue.map((entry, index) => toPublicQueueEntry(entry, service, index));
}

export function listQueueSummary() {
  return listServices().map((service) => {
    const queue = getOrderedQueueForService(service.id);
    return {
      serviceId: service.id,
      serviceName: service.name,
      queueLength: queue.length,
      estimatedWaitForNewJoinMinutes: getEstimatedWaitMinutes(service, queue.length),
    };
  });
}

export function joinQueue({ user, serviceId, priority, displayName }) {
  const payloadErrors = validateJoinPayload({ serviceId, priority, displayName });
  if (Object.keys(payloadErrors).length > 0) {
    throw new ApiError(400, "Validation failed", payloadErrors);
  }

  const service = assertServiceExists(serviceId);
  const db = getDb();
  const alreadyQueued = db
    .prepare("SELECT id FROM queue_entries WHERE user_id = ? AND service_id = ?")
    .get(user.id, Number(serviceId));

  if (alreadyQueued) {
    throw new ApiError(409, "You are already in this queue.");
  }

  const joinedAt = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO queue_entries (user_id, service_id, display_name, priority, joined_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      user.id,
      Number(serviceId),
      displayName?.trim() || deriveDisplayName(user),
      priority || service.priority || "medium",
      joinedAt
    );

  const orderedQueue = getOrderedQueueForService(service.id);
  const position = orderedQueue.findIndex((queuedEntry) => queuedEntry.id === result.lastInsertRowid);
  const entry = orderedQueue[position];

  notifyQueueJoined(user.id, service.name);
  const estimatedWaitMinutes = getEstimatedWaitMinutes(service, position);
  if (estimatedWaitMinutes <= Number(service.duration)) {
    notifyCloseToServed(user.id, service.name, estimatedWaitMinutes);
  }

  return toPublicQueueEntry(entry, service, position);
}

export function leaveQueue({ userId, serviceId }) {
  const payloadErrors = validateLeavePayload({ serviceId });
  if (Object.keys(payloadErrors).length > 0) {
    throw new ApiError(400, "Validation failed", payloadErrors);
  }

  const service = assertServiceExists(serviceId);
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM queue_entries WHERE user_id = ? AND service_id = ?")
    .get(userId, Number(serviceId));

  if (!row) {
    throw new ApiError(404, "Queue entry not found for this user and service.");
  }

  db.prepare("DELETE FROM queue_entries WHERE id = ?").run(row.id);
  const entry = toQueueEntry(row);

  recordHistory({
    userId: entry.userId,
    serviceId: entry.serviceId,
    joinedAt: entry.joinedAt,
    servedAt: null,
    outcome: "left_queue",
  });

  return {
    id: entry.id,
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service.name,
    priority: entry.priority,
    joinedAt: entry.joinedAt,
    outcome: "left_queue",
  };
}

export function serveNextUser(serviceId) {
  const errors = validateServiceIdParam(serviceId);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const service = assertServiceExists(serviceId);
  const orderedQueue = getOrderedQueueForService(service.id);
  if (orderedQueue.length === 0) {
    throw new ApiError(404, "No users are currently waiting in this queue.");
  }

  const nextEntry = orderedQueue[0];
  getDb().prepare("DELETE FROM queue_entries WHERE id = ?").run(nextEntry.id);

  const servedAt = new Date().toISOString();
  recordHistory({
    userId: nextEntry.userId,
    serviceId: nextEntry.serviceId,
    joinedAt: nextEntry.joinedAt,
    servedAt,
    outcome: "served",
  });

  const remainingQueue = getOrderedQueueForService(service.id);
  if (remainingQueue.length > 0) {
    notifyCloseToServed(remainingQueue[0].userId, service.name, 0);
  }

  return {
    id: nextEntry.id,
    userId: nextEntry.userId,
    displayName: nextEntry.displayName,
    serviceId: nextEntry.serviceId,
    serviceName: service.name,
    servedAt,
  };
}

export function listQueuesForUser(userId) {
  const entries = getDb().prepare("SELECT * FROM queue_entries WHERE user_id = ?").all(userId).map(toQueueEntry);

  return entries
    .map((entry) => {
      const service = getServiceById(entry.serviceId);
      if (!service) return null;
      const queue = getOrderedQueueForService(service.id);
      const index = queue.findIndex((queuedEntry) => queuedEntry.id === entry.id);
      if (index < 0) return null;
      return toPublicQueueEntry(entry, service, index);
    })
    .filter(Boolean)
    .sort((a, b) => a.estimatedWaitMinutes - b.estimatedWaitMinutes || a.id - b.id);
}
