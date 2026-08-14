export const VALID_EXPORT_TYPES = ["users", "services", "stats"];

function isValidDateString(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

/** Validates the optional date-range / service filters shared by every report endpoint. */
export function validateReportFilters({ startDate, endDate, serviceId } = {}) {
  const errors = {};

  if (startDate !== undefined && startDate !== null && startDate !== "" && !isValidDateString(startDate)) {
    errors.startDate = "startDate must be a valid date.";
  }

  if (endDate !== undefined && endDate !== null && endDate !== "" && !isValidDateString(endDate)) {
    errors.endDate = "endDate must be a valid date.";
  }

  if (
    startDate &&
    endDate &&
    isValidDateString(startDate) &&
    isValidDateString(endDate) &&
    Date.parse(startDate) > Date.parse(endDate)
  ) {
    errors.endDate = "endDate must not be before startDate.";
  }

  if (serviceId !== undefined && serviceId !== null && serviceId !== "") {
    const parsed = Number(serviceId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.serviceId = "serviceId must be a positive integer.";
    }
  }

  return errors;
}

/** Validates the `type` query param used by the CSV export endpoint. */
export function validateExportType(type) {
  const errors = {};
  if (!type || !VALID_EXPORT_TYPES.includes(type)) {
    errors.type = `type must be one of: ${VALID_EXPORT_TYPES.join(", ")}.`;
  }
  return errors;
}
