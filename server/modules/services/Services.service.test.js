import { describe, it, expect, beforeEach } from "vitest";

import { resetTestDb } from "../../data/db.js";
import { listServices, getServiceById, createService, updateService } from "./services.service.js";

beforeEach(() => {
  resetTestDb({ seedActivity: false });
});

describe("listServices", () => {
  it("returns the seeded services ordered by id", () => {
    const services = listServices();
    expect(services.length).toBeGreaterThanOrEqual(3);
    expect(services[0]).toHaveProperty("name");
    expect(services[0]).toHaveProperty("priority");
    const ids = services.map((s) => s.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe("getServiceById", () => {
  it("returns a single service by id", () => {
    const service = getServiceById(1);
    expect(service).toBeDefined();
    expect(service.id).toBe(1);
  });

  it("returns undefined for a non-existent id", () => {
    expect(getServiceById(9999)).toBeUndefined();
  });
});

describe("createService", () => {
  it("creates a service with valid fields", () => {
    const service = createService({
      name: "X-Ray",
      description: "Diagnostic imaging.",
      duration: 25,
      priority: "medium",
    });
    expect(service.id).toBeDefined();
    expect(service.name).toBe("X-Ray");
    expect(service.duration).toBe(25);
    expect(listServices()).toHaveLength(4);
  });

  it("trims whitespace on name and description", () => {
    const service = createService({
      name: "  Physical Therapy  ",
      description: "  Rehab session.  ",
      duration: 45,
      priority: "low",
    });
    expect(service.name).toBe("Physical Therapy");
    expect(service.description).toBe("Rehab session.");
  });

  it("rejects a missing name", () => {
    expect(() =>
      createService({ name: "", description: "desc", duration: 10, priority: "low" })
    ).toThrow(/validation failed/i);
  });

  it("rejects an invalid priority", () => {
    expect(() =>
      createService({ name: "Checkup", description: "desc", duration: 10, priority: "urgent" })
    ).toThrow();
  });

  it("rejects a non-positive duration", () => {
    expect(() =>
      createService({ name: "Checkup", description: "desc", duration: 0, priority: "low" })
    ).toThrow();
  });
});

describe("updateService", () => {
  it("updates an existing service", () => {
    const updated = updateService(1, {
      name: "General Checkup Updated",
      description: "Updated description.",
      duration: 40,
      priority: "high",
    });
    expect(updated.name).toBe("General Checkup Updated");
    expect(updated.duration).toBe(40);
    expect(updated.priority).toBe("high");
  });

  it("throws a 404-style error for a non-existent service", () => {
    expect(() =>
      updateService(9999, { name: "X", description: "Y", duration: 10, priority: "low" })
    ).toThrow(/not found/i);
  });

  it("rejects invalid fields on update", () => {
    expect(() =>
      updateService(1, { name: "", description: "Y", duration: 10, priority: "low" })
    ).toThrow(/validation failed/i);
  });
});
