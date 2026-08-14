import { Router } from "express";

import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import * as reportingService from "./reporting.service.js";

export const reportingRouter = Router();

// All reporting endpoints are Administrator-only.
reportingRouter.use(requireAuth, requireAdmin);

function extractFilters(req) {
  const { startDate, endDate, serviceId } = req.query ?? {};
  return { startDate, endDate, serviceId };
}

reportingRouter.get("/users", (req, res) => {
  const report = reportingService.getUserParticipationReport(extractFilters(req));
  res.status(200).json({ report });
});

reportingRouter.get("/services", (req, res) => {
  const report = reportingService.getServiceActivityReport(extractFilters(req));
  res.status(200).json({ report });
});

reportingRouter.get("/stats", (req, res) => {
  const stats = reportingService.getQueueUsageStats(extractFilters(req));
  res.status(200).json({ stats });
});

// GET /api/reports/export?type=users|services|stats&format=csv&startDate=&endDate=&serviceId=
reportingRouter.get("/export", (req, res) => {
  const { type } = req.query ?? {};
  const { filename, csv } = reportingService.exportReportCsv(type, extractFilters(req));

  res.status(200);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});
