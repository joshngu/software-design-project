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

describe("GET /api/history", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/history");
    expect(res.status).toBe(401);
  });

  it("returns only the authenticated user's history, most recent first", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/history").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.history.length).toBeGreaterThan(0);
    res.body.history.forEach((h) => expect(h.userId).toBe(1));

    const dates = res.body.history.map((h) => new Date(h.joinedAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("returns an empty list for a user with no history", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/history").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.history).toEqual([]);
  });
});
