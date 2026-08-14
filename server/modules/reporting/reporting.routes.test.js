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

describe("GET /api/reports/*", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/reports/users");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/reports/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns the user participation report for admins", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/reports/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.report.length).toBeGreaterThan(0);
  });

  it("returns the service activity report for admins", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/reports/services").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.report.length).toBe(3);
  });

  it("returns queue usage stats for admins", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/reports/stats").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.usersServed).toBe(2);
  });

  it("applies query filters", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .get("/api/reports/stats")
      .query({ serviceId: 3 })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.totalEntries).toBe(1);
  });

  it("returns 400 for invalid filters", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .get("/api/reports/stats")
      .query({ startDate: "not-a-date" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/reports/export", () => {
  it("rejects non-admin users", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app)
      .get("/api/reports/export")
      .query({ type: "users" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("downloads a CSV file for admins", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .get("/api/reports/export")
      .query({ type: "users" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.text.split("\n")[0]).toContain("userId");
  });

  it("returns 400 for a missing or invalid type", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).get("/api/reports/export").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
