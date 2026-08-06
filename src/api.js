/* Thin fetch wrapper for the QueueSmart backend (server/). */

class ApiRequestError extends Error {
  constructor(message, fieldErrors) {
    super(message);
    this.fieldErrors = fieldErrors || {};
  }
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

export function registerUser({ email, password, fullName, phone, role }) {
  return request("/auth/register", { method: "POST", body: { email, password, fullName, phone, role } });
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

export function fetchNotifications(token) {
  return request("/notifications", { token });
}

export function markNotificationRead(token, id) {
  return request(`/notifications/${id}/read`, { method: "POST", token });
}

export function fetchHistory(token) {
  return request("/history", { token });
}

export function joinQueue(token, { serviceId, priority, displayName }) {
  return request("/queue/join", {
    method: "POST",
    token,
    body: { serviceId, priority, displayName },
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

export { ApiRequestError };
