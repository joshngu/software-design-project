import express from "express";
import cors from "cors";

import { authRouter } from "./modules/auth/auth.routes.js";
import { servicesRouter } from "./modules/services/services.routes.js";
import { queueRouter } from "./modules/queue/queue.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { historyRouter } from "./modules/history/history.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { reportingRouter } from "./modules/reporting/reporting.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/queue", queueRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/reports", reportingRouter);

  app.use(errorHandler);

  return app;
}
