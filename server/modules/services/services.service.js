import { getDb } from "../../data/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { validateService } from "./services.validation.js";

export function listServices() {
  return getDb().prepare("SELECT id, name, description, duration, priority FROM services ORDER BY id").all();
}

export function getServiceById(id) {
  return getDb().prepare("SELECT id, name, description, duration, priority FROM services WHERE id = ?").get(Number(id));
}

export function createService({ name, description, duration, priority }) {
  const errors = validateService({ name, description, duration, priority });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO services (name, description, duration, priority) VALUES (?, ?, ?, ?)")
    .run(name.trim(), description.trim(), Number(duration), priority);

  return getServiceById(result.lastInsertRowid);
}

export function updateService(id, { name, description, duration, priority }) {
  const db = getDb();
  const existing = getServiceById(id);
  if (!existing) {
    throw new ApiError(404, "Service not found.");
  }

  const errors = validateService({ name, description, duration, priority });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  db.prepare("UPDATE services SET name = ?, description = ?, duration = ?, priority = ? WHERE id = ?").run(
    name.trim(),
    description.trim(),
    Number(duration),
    priority,
    Number(id)
  );

  return getServiceById(id);
}

export function deleteService(id) {
  const existing = getServiceById(id);
  if (!existing) {
    throw new ApiError(404, "Service not found.");
  }

  getDb().prepare("DELETE FROM services WHERE id = ?").run(Number(id));
  return existing;
}
