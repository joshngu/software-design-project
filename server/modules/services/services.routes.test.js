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

describe("GET /api/services", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/services");
    expect(res.status).toBe(401);
  });

  it("lists seeded services for an authenticated user", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).get("/api/services").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(3);
  });
});

describe("POST /api/services", () => {
  it("rejects a non-admin user with 403", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Service", description: "desc", duration: 10, priority: "low" });

    expect(res.status).toBe(403);
  });

  it("creates a service for an admin with valid input", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Service", description: "desc", duration: 10, priority: "low" });

    expect(res.status).toBe(201);
    expect(res.body.service).toMatchObject({
      name: "New Service",
      description: "desc",
      duration: 10,
      priority: "low",
    });
  });

  it("returns 400 with field errors for invalid input", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", description: "", duration: -1, priority: "extreme" });

    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      name: expect.any(String),
      description: expect.any(String),
      duration: expect.any(String),
      priority: expect.any(String),
    });
  });
});

describe("PUT /api/services/:id", () => {
  it("updates an existing service for an admin", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .put("/api/services/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Checkup", description: "updated", duration: 45, priority: "high" });

    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({
      id: 1,
      name: "Updated Checkup",
      duration: 45,
      priority: "high",
    });
  });

  it("returns 404 for a non-existent service", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app)
      .put("/api/services/999")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", description: "Y", duration: 5, priority: "low" });

    expect(res.status).toBe(404);
  });

  it("rejects a non-admin user with 403", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app)
      .put("/api/services/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", description: "Y", duration: 5, priority: "low" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/services/:id", () => {
  it("deletes an existing service for an admin", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).delete("/api/services/1").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({ id: 1, name: "General Checkup" });

    const listRes = await request(app).get("/api/services").set("Authorization", `Bearer ${token}`);
    expect(listRes.body.services.map((service) => service.id)).not.toContain(1);
  });

  it("returns 404 for a non-existent service", async () => {
    const token = await loginAs("admin@queuesmart.com", "Passw0rd!");
    const res = await request(app).delete("/api/services/999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("rejects a non-admin user with 403", async () => {
    const token = await loginAs("jane@example.com", "Passw0rd!");
    const res = await request(app).delete("/api/services/1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
