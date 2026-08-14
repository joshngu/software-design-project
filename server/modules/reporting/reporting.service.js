import { stringify } from "csv-stringify/sync";

import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { listServices } from "../services/services.service.js";
import { getAverageServiceDurationMinutes } from "../history/history.service.js";
import { validateReportFilters, validateExportType } from "./reporting.validation.js";

/*
 * Reporting Module.
 * Administrator-only reports built from the `history` (queue participation),
 * `services`, and `queues`/`queue_entries` tables. Every report accepts the
 * same optional filters: startDate, endDate (inclusive date range applied to
 * history.joined_at), and serviceId.
 */

function toRangeStart(dateStr) {
  return dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00.000Z`;
}

function toRangeEnd(dateStr) {
  return dateStr.includes("T") ? dateStr : `${dateStr}T23:59:59.999Z`;
}

/** Builds a "AND ..." SQL fragment (plus bound params) for the shared history filters. */
function buildHistoryFilter({ startDate, endDate, serviceId } = {}) {
  const clauses = [];
  const params = [];

  if (startDate) {
    clauses.push("AND joined_at >= ?");
    params.push(toRangeStart(startDate));
  }
  if (endDate) {
    clauses.push("AND joined_at <= ?");
    params.push(toRangeEnd(endDate));
  }
  if (serviceId) {
    clauses.push("AND service_id = ?");
    params.push(Number(serviceId));
  }

  return { clause: clauses.join(" "), params };
}

function assertValidFilters(filters) {
  const errors = validateReportFilters(filters);
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }
}

/** List of users/customers and their queue participation history. */
export function getUserParticipationReport(filters = {}) {
  assertValidFilters(filters);
  const db = getDb();

  const users = db
    .prepare(
      `SELECT uc.id, uc.email, uc.role, up.full_name AS fullName
       FROM user_credentials uc
       JOIN user_profiles up ON up.user_id = uc.id
       ORDER BY uc.id`
    )
    .all();

  const { clause, params } = buildHistoryFilter(filters);
  const historyStmt = db.prepare(
    `SELECT h.service_id AS serviceId, s.name AS serviceName, h.joined_at AS joinedAt,
            h.served_at AS servedAt, h.outcome
     FROM history h
     JOIN services s ON s.id = h.service_id
     WHERE h.user_id = ? ${clause}
     ORDER BY h.joined_at DESC`
  );

  return users.map((user) => {
    const entries = historyStmt.all(user.id, ...params);
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      totalVisits: entries.length,
      servedCount: entries.filter((e) => e.outcome === "served").length,
      leftQueueCount: entries.filter((e) => e.outcome === "left_queue").length,
      noShowCount: entries.filter((e) => e.outcome === "no_show").length,
      lastVisit: entries[0]?.joinedAt ?? null,
      entries,
    };
  });
}

/** Service details plus queue activity (current queue length, historical outcomes). */
export function getServiceActivityReport(filters = {}) {
  assertValidFilters(filters);
  const db = getDb();

  const services = filters.serviceId
    ? listServices().filter((s) => s.id === Number(filters.serviceId))
    : listServices();

  const { clause, params } = buildHistoryFilter({ startDate: filters.startDate, endDate: filters.endDate });

  return services.map((service) => {
    const entries = db
      .prepare(`SELECT outcome FROM history WHERE service_id = ? ${clause}`)
      .all(service.id, ...params);

    const queue = db.prepare("SELECT id, status FROM queues WHERE service_id = ?").get(service.id);
    const currentQueueLength = queue
      ? Number(
          db
            .prepare("SELECT COUNT(*) AS count FROM queue_entries WHERE queue_id = ? AND status = 'waiting'")
            .get(queue.id).count
        )
      : 0;

    return {
      serviceId: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      priority: service.priority,
      queueStatus: queue?.status ?? "closed",
      currentQueueLength,
      totalVisits: entries.length,
      servedCount: entries.filter((e) => e.outcome === "served").length,
      leftQueueCount: entries.filter((e) => e.outcome === "left_queue").length,
      noShowCount: entries.filter((e) => e.outcome === "no_show").length,
      averageWaitMinutes: getAverageServiceDurationMinutes(service.id),
    };
  });
}

/** Queue usage statistics — users served, wait-time average, etc. */
export function getQueueUsageStats(filters = {}) {
  assertValidFilters(filters);
  const db = getDb();
  const { clause, params } = buildHistoryFilter(filters);

  const totalEntries = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM history WHERE 1 = 1 ${clause}`).get(...params).count
  );
  const usersServed = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM history WHERE outcome = 'served' ${clause}`).get(...params).count
  );
  const leftQueueCount = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM history WHERE outcome = 'left_queue' ${clause}`).get(...params).count
  );
  const noShowCount = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM history WHERE outcome = 'no_show' ${clause}`).get(...params).count
  );

  const avgRow = db
    .prepare(
      `SELECT AVG((julianday(served_at) - julianday(joined_at)) * 24 * 60) AS avgMinutes
       FROM history
       WHERE outcome = 'served' AND served_at IS NOT NULL ${clause}`
    )
    .get(...params);
  const averageWaitMinutes = avgRow.avgMinutes !== null ? Math.round(avgRow.avgMinutes * 10) / 10 : null;

  const currentlyWaiting = Number(
    db.prepare("SELECT COUNT(*) AS count FROM queue_entries WHERE status = 'waiting'").get().count
  );

  return { totalEntries, usersServed, leftQueueCount, noShowCount, averageWaitMinutes, currentlyWaiting };
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  return stringify(rows, { header: true });
}

/** Generates a CSV export for one of the three report types. */
export function exportReportCsv(type, filters = {}) {
  const typeErrors = validateExportType(type);
  if (Object.keys(typeErrors).length > 0) {
    throw new ApiError(400, "Validation failed", typeErrors);
  }

  const timestamp = new Date().toISOString().slice(0, 10);

  if (type === "users") {
    const rows = getUserParticipationReport(filters).map(({ entries, ...row }) => ({
      ...row,
      lastVisit: row.lastVisit ?? "",
    }));
    return { filename: `user-participation-report-${timestamp}.csv`, csv: toCsv(rows) };
  }

  if (type === "services") {
    const rows = getServiceActivityReport(filters).map((row) => ({
      ...row,
      averageWaitMinutes: row.averageWaitMinutes ?? "",
    }));
    return { filename: `service-activity-report-${timestamp}.csv`, csv: toCsv(rows) };
  }

  const stats = getQueueUsageStats(filters);
  const row = { ...stats, averageWaitMinutes: stats.averageWaitMinutes ?? "" };
  return { filename: `queue-usage-stats-${timestamp}.csv`, csv: toCsv([row]) };
}
