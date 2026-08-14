import { describe, it, expect } from "vitest";

import { validateReportFilters, validateExportType } from "./reporting.validation.js";

describe("validateReportFilters", () => {
  it("passes with no filters", () => {
    expect(validateReportFilters({})).toEqual({});
  });

  it("passes with valid date-only filters", () => {
    expect(validateReportFilters({ startDate: "2026-01-01", endDate: "2026-01-31" })).toEqual({});
  });

  it("passes with a valid full ISO timestamp", () => {
    expect(validateReportFilters({ startDate: "2026-01-01T10:00:00.000Z" })).toEqual({});
  });

  it("rejects a malformed startDate", () => {
    const errors = validateReportFilters({ startDate: "not-a-date" });
    expect(errors.startDate).toMatch(/valid date/i);
  });

  it("rejects a malformed endDate", () => {
    const errors = validateReportFilters({ endDate: "also-not-a-date" });
    expect(errors.endDate).toMatch(/valid date/i);
  });

  it("rejects endDate earlier than startDate", () => {
    const errors = validateReportFilters({ startDate: "2026-02-01", endDate: "2026-01-01" });
    expect(errors.endDate).toMatch(/not be before/i);
  });

  it("accepts a valid positive-integer serviceId", () => {
    expect(validateReportFilters({ serviceId: "2" })).toEqual({});
  });

  it("rejects a non-integer serviceId", () => {
    const errors = validateReportFilters({ serviceId: "abc" });
    expect(errors.serviceId).toMatch(/positive integer/i);
  });

  it("rejects a zero or negative serviceId", () => {
    expect(validateReportFilters({ serviceId: "0" }).serviceId).toMatch(/positive integer/i);
    expect(validateReportFilters({ serviceId: "-1" }).serviceId).toMatch(/positive integer/i);
  });
});

describe("validateExportType", () => {
  it("accepts each valid type", () => {
    expect(validateExportType("users")).toEqual({});
    expect(validateExportType("services")).toEqual({});
    expect(validateExportType("stats")).toEqual({});
  });

  it("rejects a missing type", () => {
    const errors = validateExportType(undefined);
    expect(errors.type).toMatch(/must be one of/i);
  });

  it("rejects an unrecognized type", () => {
    const errors = validateExportType("finance");
    expect(errors.type).toMatch(/must be one of/i);
  });
});
