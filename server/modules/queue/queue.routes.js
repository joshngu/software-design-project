import { Router } from "express";

import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import * as queueService from "./queue.service.js";

export const queueRouter = Router();

queueRouter.post("/join", requireAuth, (req, res) => {
  const { serviceId, displayName } = req.body ?? {};
  const queueEntry = queueService.joinQueue({
    user: req.user,
    serviceId,
    displayName,
  });
  res.status(201).json({ queueEntry });
});

queueRouter.post("/leave", requireAuth, (req, res) => {
  const { serviceId } = req.body ?? {};
  const queueEntry = queueService.leaveQueue({
    userId: req.user.id,
    serviceId,
  });
  res.status(200).json({ queueEntry });
});

queueRouter.get("/me", requireAuth, (req, res) => {
  const queues = queueService.listQueuesForUser(req.user.id);
  res.status(200).json({
    queues,
    activeQueue: queues[0] || null,
  });
});

queueRouter.get("/summary", requireAuth, requireAdmin, (req, res) => {
  const summary = queueService.listQueueSummary();
  res.status(200).json({ summary });
});

queueRouter.get("/:serviceId", requireAuth, requireAdmin, (req, res) => {
  const queue = queueService.listQueueForService(req.params.serviceId);
  res.status(200).json({ queue });
});

queueRouter.post("/:serviceId/serve-next", requireAuth, requireAdmin, (req, res) => {
  const served = queueService.serveNextUser(req.params.serviceId);
  res.status(200).json({ served });
});
