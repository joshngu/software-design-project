import { describe, it, expect } from "vitest";

import { validateJoinPayload, validateLeavePayload, validateServiceIdParam } from "./queue.validation.js";

describe("validateJoinPayload", () => {
  it("accepts a valid payload", () => {
    const errors = validateJoinPayload({ serviceId: 1, priority: "high", displayName: "Jane Doe" });
    expect(errors).toEqual({});
  });

  it("returns errors for invalid required and typed fields", () => {
    const errors = validateJoinPayload({ serviceId: "abc", priority: "urgent", displayName: "" });
    expect(errors.serviceId).toBeTruthy();
    expect(errors.priority).toBeTruthy();
    expect(errors.displayName).toBeTruthy();
  });

  it("enforces display name length limits", () => {
    const errors = validateJoinPayload({
      serviceId: 1,
      displayName: "x".repeat(81),
    });
    expect(errors.displayName).toMatch(/must not exceed/i);
  });
});

describe("validateLeavePayload", () => {
  it("requires a positive integer service id", () => {
    expect(validateLeavePayload({ serviceId: 2 })).toEqual({});
    expect(validateLeavePayload({ serviceId: 0 }).serviceId).toBeTruthy();
  });
});

describe("validateServiceIdParam", () => {
  it("rejects non-numeric service ids", () => {
    const errors = validateServiceIdParam("foo");
    expect(errors.serviceId).toBeTruthy();
  });
});
