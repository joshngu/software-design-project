import { describe, it, expect, beforeEach } from "vitest";

import { resetTestDb } from "../../data/db.js";
import { register, login, getUserForToken } from "./auth.service.js";

beforeEach(() => {
  resetTestDb({ seedActivity: false });
});

describe("register", () => {
  it("creates a new user and returns a public user + token", () => {
    const { user, token } = register({
      email: "new.user@example.com",
      password: "Passw0rd!",
      fullName: "New User",
      phone: "555-1234",
      role: "user",
    });

    expect(token).toBeDefined();
    expect(user.email).toBe("new.user@example.com");
    expect(user.fullName).toBe("New User");
    expect(user.role).toBe("user");
    // Password/hash must never be exposed on the public user object.
    expect(user.password).toBeUndefined();
    expect(user.passwordHash).toBeUndefined();
  });

  it("defaults role to 'user' when omitted", () => {
    const { user } = register({
      email: "role.default@example.com",
      password: "Passw0rd!",
      fullName: "Role Default",
    });
    expect(user.role).toBe("user");
  });

  it("rejects duplicate emails (case-insensitive)", () => {
    register({
      email: "dupe@example.com",
      password: "Passw0rd!",
      fullName: "First",
    });

    try {
      register({
        email: "DUPE@example.com",
        password: "Passw0rd!",
        fullName: "Second",
      });
      expect.unreachable("expected register() to throw on a duplicate email");
    } catch (err) {
      expect(err.statusCode).toBe(409);
      expect(err.fieldErrors.email).toMatch(/already registered/i);
    }
  });

  it("rejects invalid registration fields (short password)", () => {
    expect(() =>
      register({
        email: "bad@example.com",
        password: "short1",
        fullName: "Bad Password",
      })
    ).toThrow(/validation failed/i);
  });

  it("rejects a missing full name", () => {
    expect(() =>
      register({ email: "noname@example.com", password: "Passw0rd!", fullName: "" })
    ).toThrow(/validation failed/i);
  });
});

describe("login", () => {
  beforeEach(() => {
    register({
      email: "login.user@example.com",
      password: "Passw0rd!",
      fullName: "Login User",
    });
  });

  it("logs in with correct credentials", () => {
    const { user, token } = login({ email: "login.user@example.com", password: "Passw0rd!" });
    expect(token).toBeDefined();
    expect(user.email).toBe("login.user@example.com");
  });

  it("is case-insensitive on email", () => {
    const { user } = login({ email: "LOGIN.USER@example.com", password: "Passw0rd!" });
    expect(user.email).toBe("login.user@example.com");
  });

  it("rejects an incorrect password", () => {
    expect(() => login({ email: "login.user@example.com", password: "WrongPass1" })).toThrow(
      /incorrect email or password/i
    );
  });

  it("rejects a non-existent email", () => {
    expect(() => login({ email: "ghost@example.com", password: "Passw0rd!" })).toThrow(
      /incorrect email or password/i
    );
  });

  it("rejects missing fields before hitting the database", () => {
    expect(() => login({ email: "", password: "" })).toThrow(/validation failed/i);
  });
});

describe("getUserForToken", () => {
  it("returns the user for a valid session token", () => {
    const { token, user } = register({
      email: "session.user@example.com",
      password: "Passw0rd!",
      fullName: "Session User",
    });

    const resolved = getUserForToken(token);
    expect(resolved).toEqual(user);
  });

  it("returns null for an unknown token", () => {
    expect(getUserForToken("not-a-real-token")).toBeNull();
  });

  it("returns null when no token is provided", () => {
    expect(getUserForToken(undefined)).toBeNull();
  });
});
