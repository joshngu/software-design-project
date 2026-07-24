const VALID_PRIORITIES = ["low", "medium", "high"];
const MAX_DISPLAY_NAME_LENGTH = 80;

function validateServiceIdValue(serviceId) {
  const parsed = Number(serviceId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "Service ID must be a positive integer.";
  }
  return null;
}

export function validateJoinPayload({ serviceId, priority, displayName }) {
  const errors = {};

  const serviceIdError = validateServiceIdValue(serviceId);
  if (serviceIdError) {
    errors.serviceId = serviceIdError;
  }

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || !displayName.trim()) {
      errors.displayName = "Display name must be a non-empty string when provided.";
    } else if (displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      errors.displayName = `Display name must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters.`;
    }
  }

  if (priority !== undefined && priority !== null && priority !== "") {
    if (typeof priority !== "string") {
      errors.priority = "Priority must be a string.";
    } else if (!VALID_PRIORITIES.includes(priority)) {
      errors.priority = "Priority must be one of low, medium, or high.";
    }
  }

  return errors;
}

export function validateLeavePayload({ serviceId }) {
  const errors = {};
  const serviceIdError = validateServiceIdValue(serviceId);
  if (serviceIdError) {
    errors.serviceId = serviceIdError;
  }
  return errors;
}

export function validateServiceIdParam(serviceId) {
  const errors = {};
  const serviceIdError = validateServiceIdValue(serviceId);
  if (serviceIdError) {
    errors.serviceId = serviceIdError;
  }
  return errors;
}
