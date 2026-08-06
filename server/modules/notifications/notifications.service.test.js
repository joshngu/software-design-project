import { describe, it, expect, beforeEach } from "vitest";

import { resetTestDb } from "../../data/db.js";
import {
  notify,
  notifyQueueJoined,
  notifyCloseToServed,
  listNotificationsForUser,
  markNotificationRead,
} from "./notifications.service.js";

beforeEach(() => {
  resetTestDb({ seedActivity: false });
});

describe("notify", () => {
  it("creates a notification with the given type and message", () => {
    const notification = notify(1, "queue_joined", "You joined the queue.");
    expect(notification.id).toBeDefined();
    expect(notification.userId).toBe(1);
    expect(notification.read).toBe(false);
  });

  it("rejects an unknown notification type", () => {
    expect(() => notify(1, "not_a_type", "msg")).toThrow();
  });

  it("rejects a missing message", () => {
    expect(() => notify(1, "queue_joined", "")).toThrow();
  });
});

describe("notifyQueueJoined / notifyCloseToServed", () => {
  it("sends a queue_joined notification with the service name in the message", () => {
    const notification = notifyQueueJoined(1, "General Checkup");
    expect(notification.type).toBe("queue_joined");
    expect(notification.message).toContain("General Checkup");
  });

  it("sends a close_to_served notification including the estimated wait", () => {
    const notification = notifyCloseToServed(1, "Vaccination", 10);
    expect(notification.type).toBe("close_to_served");
    expect(notification.message).toContain("10");
  });
});

describe("listNotificationsForUser", () => {
  it("returns only the requesting user's notifications, newest first", () => {
    notify(1, "queue_joined", "first");
    notify(2, "queue_joined", "other user");
    notify(1, "close_to_served", "second");

    const results = listNotificationsForUser(1);
    expect(results).toHaveLength(2);
    expect(results[0].message).toBe("second");
  });
});

describe("markNotificationRead", () => {
  it("marks a notification as read for its owner", () => {
    const notification = notify(1, "queue_joined", "msg");
    const updated = markNotificationRead(notification.id, 1);
    expect(updated.read).toBe(true);
  });

  it("returns null when the notification belongs to a different user", () => {
    const notification = notify(1, "queue_joined", "msg");
    expect(markNotificationRead(notification.id, 2)).toBeNull();
  });

  it("returns null for an unknown notification id", () => {
    expect(markNotificationRead(9999, 1)).toBeNull();
  });
});
