import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "../../data/db.js";
import { listHistoryForUser, recordHistory } from "../history/history.service.js";
import {
  joinQueue,
  leaveQueue,
  listQueueForService,
  listQueueSummary,
  listQueuesForUser,
  serveNextUser,
} from "./queue.service.js";

beforeEach(() => {
  resetTestDb({ seedActivity: false });
});

describe("joinQueue", () => {
  it("adds a user to a queue and computes position/wait time", () => {
    const first = joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    const second = joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 1 });

    expect(first.position).toBe(1);
    expect(first.estimatedWaitMinutes).toBe(0);
    expect(second.position).toBe(2);
    expect(second.estimatedWaitMinutes).toBe(30);
  });

  it("orders higher priority users ahead of lower priority users", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1, priority: "low" });
    const highPriority = joinQueue({
      user: { id: 2, email: "alex@example.com" },
      serviceId: 1,
      priority: "high",
    });
    const queue = listQueueForService(1);

    expect(queue[0].userId).toBe(2);
    expect(highPriority.position).toBe(1);
  });

  it("keeps arrival order when users have the same priority", () => {
    const first = joinQueue({
      user: { id: 1, email: "jane@example.com" },
      serviceId: 2,
      priority: "medium",
    });
    const second = joinQueue({
      user: { id: 2, email: "alex@example.com" },
      serviceId: 2,
      priority: "medium",
    });
    const queue = listQueueForService(2);

    expect(queue[0].userId).toBe(first.userId);
    expect(queue[1].userId).toBe(second.userId);
  });
});

describe("leaveQueue", () => {
  it("removes the user from queue and records left_queue history", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    const left = leaveQueue({ userId: 1, serviceId: 1 });

    expect(left.outcome).toBe("left_queue");
    expect(listQueuesForUser(1)).toHaveLength(0);
    const history = listHistoryForUser(1);
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe("left_queue");
  });
});

describe("serveNextUser", () => {
  it("serves the next queued user and records served history", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 1 });

    const served = serveNextUser(1);
    expect(served.userId).toBe(1);
    expect(listQueueForService(1)).toHaveLength(1);
    const history = listHistoryForUser(1);
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe("served");
  });

  it("serves high-priority users before low-priority users", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 3, priority: "low" });
    joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 3, priority: "high" });

    const served = serveNextUser(3);
    expect(served.userId).toBe(2);
  });
});

describe("listQueueSummary / listQueuesForUser", () => {
  it("returns queue length and wait estimate per service", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 2 });
    const summary = listQueueSummary();
    const vaccination = summary.find((item) => item.serviceId === 2);

    expect(vaccination.queueLength).toBe(1);
    expect(vaccination.estimatedWaitForNewJoinMinutes).toBe(15);
  });

  it("returns active queues for a specific user", () => {
    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    joinQueue({ user: { id: 2, email: "alex@example.com" }, serviceId: 1, priority: "high" });

    const queues = listQueuesForUser(1);
    expect(queues).toHaveLength(1);
    expect(queues[0].serviceId).toBe(1);
    expect(queues[0].position).toBe(2);
  });
});

describe("adaptive wait-time estimation (smart feature)", () => {
  it("switches from the static duration to a historical average once enough data exists", () => {
    // Seed 3 completed ("served") history entries for General Checkup (service 1,
    // static duration 30 min), each taking exactly 10 real minutes to serve.
    // This crosses the minSamples threshold, so the estimate should now use
    // the real 10-minute average instead of the static 30-minute duration.
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T00:00:00.000Z",
      servedAt: "2026-01-01T00:10:00.000Z",
      outcome: "served",
    });
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T01:00:00.000Z",
      servedAt: "2026-01-01T01:10:00.000Z",
      outcome: "served",
    });
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T02:00:00.000Z",
      servedAt: "2026-01-01T02:10:00.000Z",
      outcome: "served",
    });

    const first = joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    const second = joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 1 });

    // Without history, second.estimatedWaitMinutes would be 30 (1 person ahead x
    // the static 30-min duration). With 3 served entries averaging 10 minutes
    // each, it should now be 10 instead.
    expect(second.estimatedWaitMinutes).toBe(10);
    expect(first.usingHistoricalEstimate).toBe(true);
    expect(second.usingHistoricalEstimate).toBe(true);
  });

  it("falls back to the static duration when there is not enough history yet", () => {
    // Only 2 served entries -- below the minSamples threshold of 3 -- so the
    // estimate should still use the static 30-minute duration.
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T00:00:00.000Z",
      servedAt: "2026-01-01T00:10:00.000Z",
      outcome: "served",
    });
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T01:00:00.000Z",
      servedAt: "2026-01-01T01:10:00.000Z",
      outcome: "served",
    });

    const first = joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    const second = joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 1 });

    expect(second.estimatedWaitMinutes).toBe(30);
    expect(first.usingHistoricalEstimate).toBe(false);
    expect(second.usingHistoricalEstimate).toBe(false);
  });

  it("reflects the historical average in the queue summary for new joiners", () => {
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T00:00:00.000Z",
      servedAt: "2026-01-01T00:10:00.000Z",
      outcome: "served",
    });
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T01:00:00.000Z",
      servedAt: "2026-01-01T01:10:00.000Z",
      outcome: "served",
    });
    recordHistory({
      userId: 1,
      serviceId: 1,
      joinedAt: "2026-01-01T02:00:00.000Z",
      servedAt: "2026-01-01T02:10:00.000Z",
      outcome: "served",
    });

    joinQueue({ user: { id: 1, email: "jane@example.com" }, serviceId: 1 });
    joinQueue({ user: { id: 2, email: "sam@example.com" }, serviceId: 1 });

    const summary = listQueueSummary();
    const generalCheckup = summary.find((item) => item.serviceId === 1);

    // 2 people waiting x the 10-minute historical average = 20, not 60.
    expect(generalCheckup.estimatedWaitForNewJoinMinutes).toBe(20);
  });
});