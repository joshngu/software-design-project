import { Router } from "express";

import { requireAuth, requireAdmin } from "../../middleware/auth.js";
import * as servicesService from "./services.service.js";

export const servicesRouter = Router();

servicesRouter.get("/", requireAuth, (req, res) => {
  res.status(200).json({ services: servicesService.listServices() });
});

servicesRouter.post("/", requireAuth, requireAdmin, (req, res) => {
  const { name, description, duration, priority } = req.body ?? {};
  const service = servicesService.createService({ name, description, duration, priority });
  res.status(201).json({ service });
});

servicesRouter.put("/:id", requireAuth, requireAdmin, (req, res) => {
  const { name, description, duration, priority } = req.body ?? {};
  const service = servicesService.updateService(req.params.id, {
    name,
    description,
    duration,
    priority,
  });
  res.status(200).json({ service });
});

servicesRouter.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const service = servicesService.deleteService(req.params.id);
  res.status(200).json({ service });
});
