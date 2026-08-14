import { describe, it, expect, beforeEach } from "vitest";

import { resetTestDb } from "../../data/db.js";
import {
  getUserParticipationReport,
  getServiceActivityReport,
  getQueueUsageStats,
  exportReportCsv,
} from "./reporting.service.js";

describe("getUserParticipationReport", () => {
  beforeEach(() => {
    resetTestDb();
  });

  it("summarizes each user's queue participation history", () => {
    const report = getUserParticipationReport({});
    const jane = report.find((r) => r.email === "jane@example.com");
    const admin = report.find((r) => r.email === "admin@queuesmart.com");

    expect(jane.totalVisits).toBe(3);
    expect(jane.servedCount).toBe(2);
    expect(jane.leftQueueCount).toBe(1);
    expect(jane.entries).toHaveLength(3);
    expect(admin.totalVisits).toBe(0);
  });

  it("filters entries by serviceId", () => {
    const report = getUserParticipationReport({ serviceId: 3 });
    const jane = report.find((r) => r.email === "jane@example.com");
    expect(jane.totalVisits).toBe(1);
    expect(jane.entries[0].serviceId).toBe(3);
  });

  it("filters entries by date range", () => {
    const report = getUserParticipationReport({ startDate: "2026-07-05", endDate: "2026-07-10" });
    const jane = report.find((r) => r.email === "jane@example.com");
    expect(jane.totalVisits).toBe(1);
    expect(jane.entries[0].serviceId).toBe(3);
  });

  it("throws for invalid filters", () => {
    expect(() => getUserParticipationReport({ startDate: "nope" })).toThrow(/validation failed/i);
  });
});

describe("getServiceActivityReport", () => {
  beforeEach(() => {
    resetTestDb();
  });

  it("returns activity for every service by default", () => {
    const report = getServiceActivityReport({});
    expect(report).toHaveLength(3);
    const generalCheckup = report.find((r) => r.serviceId === 1);
    expect(generalCheckup.currentQueueLength).toBe(1);
    expect(generalCheckup.queueStatus).toBe("open");
    expect(generalCheckup.leftQueueCount).toBe(1);
  });

  it("filters down to a single service", () => {
    const report = getServiceActivityReport({ serviceId: 2 });
    expect(report).toHaveLength(1);
    expect(report[0].servedCount).toBe(1);
    expect(report[0].currentQueueLength).toBe(0);
  });
});

describe("getQueueUsageStats", () => {
  beforeEach(() => {
    resetTestDb();
  });

  it("computes overall stats from history", () => {
    const stats = getQueueUsageStats({});
    expect(stats.totalEntries).toBe(3);
    expect(stats.usersServed).toBe(2);
    expect(stats.leftQueueCount).toBe(1);
    expect(stats.noShowCount).toBe(0);
    expect(stats.averageWaitMinutes).toBeGreaterThan(0);
    expect(stats.currentlyWaiting).toBe(1);
  });

  it("scopes stats to a single service", () => {
    const stats = getQueueUsageStats({ serviceId: 3 });
    expect(stats.totalEntries).toBe(1);
    expect(stats.usersServed).toBe(1);
  });

  it("returns a null average wait when nothing has been served yet", () => {
    resetTestDb({ seedActivity: false });
    const stats = getQueueUsageStats({});
    expect(stats.averageWaitMinutes).toBeNull();
    expect(stats.totalEntries).toBe(0);
  });
});

describe("exportReportCsv", () => {
  beforeEach(() => {
    resetTestDb();
  });

  it("exports a users CSV with a header row and no nested entries column", () => {
    const { filename, csv } = exportReportCsv("users", {});
    expect(filename).toMatch(/^user-participation-report-.*\.csv$/);
    const [header] = csv.split("\n");
    expect(header).toContain("userId");
    expect(header).not.toContain("entries");
  });

  it("exports a services CSV with one row per service", () => {
    const { csv } = exportReportCsv("services", {});
    const [header, ...rows] = csv.trim().split("\n");
    expect(header).toContain("serviceId");
    expect(rows).toHaveLength(3);
  });

  it("exports a stats CSV with a single data row", () => {
    const { csv } = exportReportCsv("stats", {});
    const rows = csv.trim().split("\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("usersServed");
  });

  it("throws for an invalid type", () => {
    expect(() => exportReportCsv("bogus", {})).toThrow(/validation failed/i);
  });

  it("throws for invalid filters passed through to the underlying report", () => {
    expect(() => exportReportCsv("users", { serviceId: "abc" })).toThrow(/validation failed/i);
  });
});
