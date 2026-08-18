const MAX_DISPLAY_NAME_LENGTH = 80;

function validateServiceIdValue(serviceId) {
  const parsed = Number(serviceId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "Service ID must be a positive integer.";
  }
  return null;
}

export function validateJoinPayload({ serviceId, displayName }) {
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
