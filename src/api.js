/* Thin fetch wrapper for the QueueSmart backend (server/). */

class ApiRequestError extends Error {
  constructor(message, fieldErrors) {
    super(message);
    this.fieldErrors = fieldErrors || {};
  }
}

function toQueryString(params = {}) {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return usable.length ? `?${new URLSearchParams(usable).toString()}` : "";
}

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiRequestError(data.message || "Request failed.", data.errors);
  }

  return data;
}

export function registerUser({ email, password, fullName, phone }) {
  return request("/auth/register", { method: "POST", body: { email, password, fullName, phone } });
}

export function loginUser({ email, password }) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function fetchServices(token) {
  return request("/services", { token });
}

export function createService(token, payload) {
  return request("/services", { method: "POST", body: payload, token });
}

export function updateService(token, id, payload) {
  return request(`/services/${id}`, { method: "PUT", body: payload, token });
}

export function deleteService(token, id) {
  return request(`/services/${id}`, { method: "DELETE", token });
}

export function fetchNotifications(token) {
  return request("/notifications", { token });
}

export function markNotificationRead(token, id) {
  return request(`/notifications/${id}/read`, { method: "POST", token });
}

export function fetchHistory(token) {
  return request("/history", { token });
}

export function joinQueue(token, { serviceId, displayName }) {
  return request("/queue/join", {
    method: "POST",
    token,
    body: { serviceId, displayName },
  });
}

export function leaveQueue(token, { serviceId }) {
  return request("/queue/leave", {
    method: "POST",
    token,
    body: { serviceId },
  });
}

export function fetchMyQueues(token) {
  return request("/queue/me", { token });
}

export function fetchQueueForService(token, serviceId) {
  return request(`/queue/${serviceId}`, { token });
}

export function fetchQueueSummary(token) {
  return request("/queue/summary", { token });
}

export function serveNextUser(token, serviceId) {
  return request(`/queue/${serviceId}/serve-next`, {
    method: "POST",
    token,
  });
}

export function fetchUserParticipationReport(token, filters = {}) {
  return request(`/reports/users${toQueryString(filters)}`, { token });
}

export function fetchServiceActivityReport(token, filters = {}) {
  return request(`/reports/services${toQueryString(filters)}`, { token });
}

export function fetchQueueUsageStats(token, filters = {}) {
  return request(`/reports/stats${toQueryString(filters)}`, { token });
}

/** Downloads a CSV report export and triggers a browser save-as. */
export async function downloadReportCsv(token, type, filters = {}) {
  const res = await fetch(`/api/reports/export${toQueryString({ ...filters, type })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiRequestError(data.message || "Export failed.", data.errors);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `${type}-report.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { ApiRequestError };
