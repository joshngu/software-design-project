import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { resetTestDb } from "../../data/db.js";

const app = createApp();

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

beforeEach(() => {
  resetTestDb();
});

describe("GET /api/notifications", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("returns only the authenticated user's notifications", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    res.body.notifications.forEach((n) => expect(n.userId).toBe(1));
  });

  it("returns an empty list for a user with no notifications", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });
});

describe("POST /api/notifications/:id/read", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/notifications/1/read");
    expect(res.status).toBe(401);
  });

  it("marks a user's own notification as read", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).post("/api/notifications/2/read").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notification.read).toBe(true);
  });

  it("returns 404 when marking another user's notification", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).post("/api/notifications/1/read").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).post("/api/notifications/not-a-number/read").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
