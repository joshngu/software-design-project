import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { resetTestDb } from "../../data/db.js";

const app = createApp();

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

beforeEach(() => {
  resetTestDb({ seedActivity: false });
});

describe("POST /api/queue/join", () => {
  it("allows an authenticated user to join a queue", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app)
      .post("/api/queue/join")
      .set("Authorization", `Bearer ${token}`)
      .send({ serviceId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.queueEntry).toMatchObject({
      serviceId: 1,
      userId: 1,
      position: 1,
    });
  });

  it("returns 400 for invalid input", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app)
      .post("/api/queue/join")
      .set("Authorization", `Bearer ${token}`)
      .send({ serviceId: "x", priority: "urgent" });

    expect(res.status).toBe(400);
    expect(res.body.errors.serviceId).toBeTruthy();
    expect(res.body.errors.priority).toBeUndefined();
  });
});

describe("POST /api/queue/leave", () => {
  it("lets a user leave a queue they joined", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    await request(app).post("/api/queue/join").set("Authorization", `Bearer ${token}`).send({ serviceId: 1 });

    const res = await request(app)
      .post("/api/queue/leave")
      .set("Authorization", `Bearer ${token}`)
      .send({ serviceId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.queueEntry.outcome).toBe("left_queue");
  });
});

describe("admin queue endpoints", () => {
  it("rejects non-admin users from viewing queue", async () => {
    const userToken = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/queue/1").set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it("allows authenticated users to read queue summary", async () => {
    const userToken = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/queue/summary").set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.summary)).toBe(true);
    expect(res.body.summary.length).toBeGreaterThan(0);
  });

  it("allows admins to view queue and serve next user", async () => {
    const userToken = await loginAs("jane@example.com", "Passw0rd!");
    await request(app).post("/api/queue/join").set("Authorization", `Bearer ${userToken}`).send({ serviceId: 1 });

    const adminToken = await loginAs("admin@queuesmart.com", "Passw0rd!");

    const queueRes = await request(app).get("/api/queue/1").set("Authorization", `Bearer ${adminToken}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.queue).toHaveLength(1);

    const serveRes = await request(app)
      .post("/api/queue/1/serve-next")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(serveRes.status).toBe(200);
    expect(serveRes.body.served.userId).toBe(1);
  });

  it("ignores client-provided priority and keeps arrival order", async () => {
    const userToken = await loginAs("jane@example.com", "Passw0rd!");
    await request(app)
      .post("/api/queue/join")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ serviceId: 1, priority: "low" });

    const adminToken = await loginAs("admin@queuesmart.com", "Passw0rd!");
    await request(app)
      .post("/api/queue/join")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceId: 1, priority: "high" });

    const queueRes = await request(app).get("/api/queue/1").set("Authorization", `Bearer ${adminToken}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.queue[0].userId).toBe(1);
    expect(queueRes.body.queue[1].userId).toBe(2);
    expect(queueRes.body.queue[0].priority).toBe("medium");
    expect(queueRes.body.queue[1].priority).toBe("medium");
  });
});

describe("GET /api/queue/me", () => {
  it("returns the current user's active queues and primary queue", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    await request(app).post("/api/queue/join").set("Authorization", `Bearer ${token}`).send({ serviceId: 2 });

    const res = await request(app).get("/api/queue/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.queues).toHaveLength(1);
    expect(res.body.activeQueue.serviceId).toBe(2);
  });
});
