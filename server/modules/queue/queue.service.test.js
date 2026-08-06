import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "../../data/db.js";
import { listHistoryForUser } from "../history/history.service.js";
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
