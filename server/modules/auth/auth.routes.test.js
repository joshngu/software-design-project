import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";

import { createApp } from "../../app.js";
import { resetTestDb } from "../../data/db.js";

const app = createApp();

beforeEach(() => {
  resetTestDb();
});

describe("POST /api/auth/register", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "Passw0rd!", fullName: "New Person" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({
      id: 3,
      email: "new@example.com",
      role: "user",
      fullName: "New Person",
      phone: null,
    });
  });

  it("persists an optional phone number on the profile", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "withphone@example.com",
      password: "Passw0rd!",
      fullName: "Has Phone",
      phone: "555-0100",
    });

    expect(res.body.user.phone).toBe("555-0100");
  });

  it("defaults role to 'user' when omitted", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new2@example.com", password: "Passw0rd!", fullName: "New Person" });

    expect(res.body.user.role).toBe("user");
  });

  it("does not allow self-registering as admin", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "attempt-admin@example.com",
      password: "Passw0rd!",
      fullName: "Admin Attempt",
      role: "admin",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
  });

  it("rejects duplicate emails with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "jane@example.com", password: "Passw0rd!", fullName: "Duplicate Jane" });

    expect(res.status).toBe(409);
    expect(res.body.errors.email).toMatch(/already registered/i);
  });

  it("returns 400 with field errors for invalid input", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeTruthy();
    expect(res.body.errors.password).toBeTruthy();
    expect(res.body.errors.fullName).toBeTruthy();
  });
});

describe("POST /api/auth/login", () => {
  it("logs in a seeded user with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@queuesmart.com", password: "Passw0rd!" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.token).toBeTruthy();
  });

  it("rejects an incorrect password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@queuesmart.com", password: "wrong" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Passw0rd!" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeTruthy();
    expect(res.body.errors.password).toBeTruthy();
  });
});
