import { db } from "../../data/store.js";
import { ApiError } from "../../utils/ApiError.js";
import { notifyCloseToServed, notifyQueueJoined } from "../notifications/notifications.service.js";
import { recordHistory } from "../history/history.service.js";
import { validateJoinPayload, validateLeavePayload, validateServiceIdParam } from "./queue.validation.js";

const PRIORITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

function getServiceById(serviceId) {
  return db.services.find((service) => service.id === Number(serviceId));
}

function compareQueueEntries(a, b) {
  const priorityDelta = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
  if (priorityDelta !== 0) return priorityDelta;
  const joinedDelta = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  if (joinedDelta !== 0) return joinedDelta;
  return a.id - b.id;
}

function getOrderedQueueForService(serviceId) {
  return db.queueEntries
    .filter((entry) => entry.serviceId === Number(serviceId))
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
  return db.services.map((service) => {
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
  const alreadyQueued = db.queueEntries.some(
    (entry) => entry.userId === user.id && entry.serviceId === Number(serviceId)
  );

  if (alreadyQueued) {
    throw new ApiError(409, "You are already in this queue.");
  }

  const entry = {
    id: db.nextQueueEntryId++,
    userId: user.id,
    displayName: displayName?.trim() || deriveDisplayName(user),
    serviceId: Number(serviceId),
    priority: priority || service.priority || "medium",
    joinedAt: new Date().toISOString(),
  };

  db.queueEntries.push(entry);
  const orderedQueue = getOrderedQueueForService(service.id);
  const position = orderedQueue.findIndex((queuedEntry) => queuedEntry.id === entry.id);

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
  const index = db.queueEntries.findIndex(
    (entry) => entry.userId === userId && entry.serviceId === Number(serviceId)
  );

  if (index < 0) {
    throw new ApiError(404, "Queue entry not found for this user and service.");
  }

  const [entry] = db.queueEntries.splice(index, 1);
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
  db.queueEntries = db.queueEntries.filter((entry) => entry.id !== nextEntry.id);

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
  const entries = db.queueEntries.filter((entry) => entry.userId === userId);

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
