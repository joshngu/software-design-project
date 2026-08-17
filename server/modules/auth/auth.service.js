import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { getDb } from "../../data/db.js";
import { sessions } from "../../data/sessions.js";
import { ApiError } from "../../utils/ApiError.js";
import { validateRegistration, validateLogin } from "./auth.validation.js";

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone ?? null,
  };
}

function findUserWithProfile(db, { id, email } = {}) {
  const where = id !== undefined ? "uc.id = ?" : "lower(uc.email) = ?";
  const param = id !== undefined ? id : email.trim().toLowerCase();
  return db
    .prepare(
      `SELECT uc.id, uc.email, uc.password_hash, uc.role, up.full_name, up.phone
       FROM user_credentials uc
       JOIN user_profiles up ON up.user_id = uc.id
       WHERE ${where}`
    )
    .get(param);
}

function createSession(userId) {
  const token = crypto.randomUUID();
  sessions.set(token, userId);
  return token;
}

export function register({ email, password, fullName, phone }) {
  const errors = validateRegistration({ email, password, fullName, phone });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const exists = db.prepare("SELECT id FROM user_credentials WHERE lower(email) = ?").get(normalizedEmail);
  if (exists) {
    throw new ApiError(409, "Registration failed", {
      email: "This email is already registered. Try logging in instead.",
    });
  }

  const passwordHash = bcrypt.hashSync(password, 8);
  const insertUser = db.prepare("INSERT INTO user_credentials (email, password_hash, role) VALUES (?, ?, ?)");
  const result = insertUser.run(email.trim(), passwordHash, "user");

  db.prepare("INSERT INTO user_profiles (user_id, full_name, email, phone) VALUES (?, ?, ?, ?)").run(
    result.lastInsertRowid,
    fullName.trim(),
    email.trim(),
    phone ? phone.trim() : null
  );

  const user = findUserWithProfile(db, { id: result.lastInsertRowid });
  const token = createSession(user.id);
  return { user: toPublicUser(user), token };
}

export function login({ email, password }) {
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const db = getDb();
  const user = findUserWithProfile(db, { email });
  const passwordMatches = user && bcrypt.compareSync(password, user.password_hash);

  if (!passwordMatches) {
    throw new ApiError(401, "Incorrect email or password.");
  }

  const token = createSession(user.id);
  return { user: toPublicUser(user), token };
}

export function getUserForToken(token) {
  const userId = token ? sessions.get(token) : undefined;
  if (!userId) return null;
  const user = findUserWithProfile(getDb(), { id: userId });
  return user ? toPublicUser(user) : null;
}
