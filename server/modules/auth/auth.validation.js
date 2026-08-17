const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_FULL_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const PHONE_RE = /^[0-9+()\-.\s]+$/;

export function validateRegistration({ email, password, fullName, phone }) {
  const errors = {};

  if (typeof email !== "string" || !email.trim()) {
    errors.email = "Email is required.";
  } else if (email.trim().length > MAX_EMAIL_LENGTH) {
    errors.email = `Email must not exceed ${MAX_EMAIL_LENGTH} characters.`;
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (typeof password !== "string" || !password) {
    errors.password = "Password is required.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`;
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }

  if (typeof fullName !== "string" || !fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (fullName.trim().length > MAX_FULL_NAME_LENGTH) {
    errors.fullName = `Full name must not exceed ${MAX_FULL_NAME_LENGTH} characters.`;
  }

  if (phone !== undefined && phone !== null && phone !== "") {
    if (typeof phone !== "string") {
      errors.phone = "Phone must be a string.";
    } else if (phone.trim().length > MAX_PHONE_LENGTH) {
      errors.phone = `Phone must not exceed ${MAX_PHONE_LENGTH} characters.`;
    } else if (!PHONE_RE.test(phone.trim())) {
      errors.phone = "Enter a valid phone number.";
    }
  }

  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};

  if (typeof email !== "string" || !email.trim()) {
    errors.email = "Email is required.";
  }

  if (typeof password !== "string" || !password) {
    errors.password = "Password is required.";
  }

  return errors;
}
