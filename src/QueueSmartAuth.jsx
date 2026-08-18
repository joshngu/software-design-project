import React, { useState, useEffect } from "react";
import {
  Ticket,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import App from "./App";
import UserApp from "./UserApp";
import { registerUser, loginUser } from "./api";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
export const COLORS = {
  ink: "#16213E",
  paper: "#F5F6F2",
  amber: "#FFB627",
  green: "#2FA84F",
  greenText: "#1E7A3C",
  coral: "#D14A3A",
  slate: "#5B6472",
  line: "#DEDCD3",
};
export const FONT_DISPLAY = "'IBM Plex Sans', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', monospace";

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function pwRules(pw) {
  return [
    { label: "8+ characters", pass: pw.length >= 8 },
    { label: "a letter", pass: /[A-Za-z]/.test(pw) },
    { label: "a number", pass: /[0-9]/.test(pw) },
  ];
}

/* ---------------------------------------------------------
   Root
--------------------------------------------------------- */
export default function QueueSmartAuth() {
  const [screen, setScreen] = useState("login"); // login | register | dashboard
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ticket, setTicket] = useState(41);

  useEffect(() => {
    const id = setInterval(() => setTicket((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  function handleLogout() {
    setCurrentUser(null);
    setToken(null);
    setScreen("login");
  }

  return (
    <div style={{ fontFamily: FONT_DISPLAY, background: COLORS.paper }} className="min-h-screen w-full">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .qs-input:focus { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; border-radius: 2px; }
        .qs-btn:focus-visible { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; }
        .qs-tick { animation: qsTickPulse 0.4s ease; display: inline-block; }
        @keyframes qsTickPulse { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }
        @media (prefers-reduced-motion: reduce) {
          .qs-tick { animation: none !important; }
        }
      `}</style>

      {screen === "dashboard" && currentUser ? (
        <Dashboard user={currentUser} token={token} onLogout={handleLogout} />
      ) : (
        <AuthShell ticket={ticket}>
          {screen === "login" ? (
            <LoginPanel
              onSuccess={(user, tok) => {
                setCurrentUser(user);
                setToken(tok);
                setScreen("dashboard");
              }}
              goRegister={() => setScreen("register")}
            />
          ) : (
            <RegisterPanel
              onRegister={(user, tok) => {
                setCurrentUser(user);
                setToken(tok);
                setScreen("dashboard");
              }}
              goLogin={() => setScreen("login")}
            />
          )}
        </AuthShell>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Shell: brand / ticket panel + perforated seam + form panel
--------------------------------------------------------- */
function AuthShell({ ticket, children }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div
        className="relative w-full md:w-2/5 flex flex-col justify-between px-8 py-10 md:px-12 md:py-14"
        style={{ background: COLORS.ink, color: COLORS.paper }}
      >
        <div>
          <div className="flex items-center gap-2">
            <Ticket size={22} strokeWidth={2} />
            <span className="text-lg font-semibold tracking-tight">QueueSmart</span>
          </div>
          <p
            className="mt-1 text-xs uppercase tracking-widest"
            style={{ fontFamily: FONT_MONO, color: COLORS.amber }}
          >
            Virtual queue access
          </p>
        </div>

        <div>
          <p className="text-2xl md:text-3xl font-semibold leading-snug max-w-xs">
            Take your place in line — from anywhere.
          </p>
          <p className="mt-3 text-sm max-w-xs" style={{ color: "#B9C0D4" }}>
            Join a queue, track your position, and get called when it's your turn. No standing required.
          </p>
        </div>

        <div className="mt-10 md:mt-0">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ fontFamily: FONT_MONO, color: "#8892AC" }}
          >
            Now serving — Front Desk
          </p>
          <div className="flex items-baseline gap-3">
            <span
              key={ticket}
              className="qs-tick text-4xl md:text-5xl font-semibold"
              style={{ fontFamily: FONT_MONO, color: COLORS.amber }}
            >
              A-{String(ticket).padStart(3, "0")}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: COLORS.green }}>
              <span className="h-2 w-2 rounded-full inline-block" style={{ background: COLORS.green }} />
              live
            </span>
          </div>
        </div>
      </div>

      <Perforation />

      <div className="w-full md:w-3/5 flex items-center justify-center px-6 py-12 md:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

function Perforation() {
  const dots = Array.from({ length: 16 });
  return (
    <div className="hidden md:block relative" style={{ width: "1px" }}>
      <div className="absolute top-0 bottom-0" style={{ left: 0, borderLeft: `2px dashed ${COLORS.line}` }} />
      <div className="h-full flex flex-col items-center justify-around py-6">
        {dots.map((_, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full block"
            style={{ marginLeft: "-7px", background: COLORS.paper, border: `2px solid ${COLORS.line}` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Shared form pieces
--------------------------------------------------------- */
function Eyebrow({ children }) {
  return (
    <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: FONT_MONO, color: COLORS.slate }}>
      {children}
    </p>
  );
}

function Field({ id, label, icon: Icon, error, children, rightSlot }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1" style={{ color: COLORS.slate }}>
        {label}
      </label>
      <div
        className="flex items-center gap-2 border-b py-1"
        style={{ borderColor: error ? COLORS.coral : COLORS.line }}
      >
        <Icon size={16} style={{ color: COLORS.slate }} />
        {children}
        {rightSlot}
      </div>
      {error && (
        <p className="mt-1 text-xs flex items-center gap-1" style={{ color: COLORS.coral }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Login
--------------------------------------------------------- */
function LoginPanel({ onSuccess, goRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e = {};
    if (!email.trim()) e.email = "Email is required.";
    else if (!validEmail(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Password is required.";
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitting(true);
    try {
      const { user, token } = await loginUser({ email: email.trim(), password });
      setErrors({});
      onSuccess(user, token);
    } catch (err) {
      setErrors(err.fieldErrors && Object.keys(err.fieldErrors).length ? err.fieldErrors : { form: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Eyebrow>Account access</Eyebrow>
      <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
        Log in
      </h1>
      <p className="mt-1 text-sm" style={{ color: COLORS.slate }}>
        New to QueueSmart?{" "}
        <button type="button" onClick={goRegister} className="underline font-medium" style={{ color: COLORS.ink }}>
          Create an account
        </button>
      </p>

      <div className="mt-6 space-y-4">
        <Field id="login-email" label="Email" icon={Mail} error={errors.email}>
          <input
            id="login-email"
            type="email"
            aria-invalid={!!errors.email}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined, form: undefined }));
            }}
          />
        </Field>

        <Field
          id="login-password"
          label="Password"
          icon={Lock}
          error={errors.password}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{ color: COLORS.slate }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input
            id="login-password"
            type={showPw ? "text" : "password"}
            aria-invalid={!!errors.password}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((p) => ({ ...p, password: undefined, form: undefined }));
            }}
          />
        </Field>

        {errors.form && (
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.coral }}>
            <AlertCircle size={16} /> {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="qs-btn w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold mt-2"
          style={{ background: COLORS.ink, color: COLORS.paper, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Checking…" : "Get in line"} <ArrowRight size={16} />
        </button>
      </div>

      <div
        className="mt-6 p-3 rounded-lg text-xs leading-relaxed"
        style={{ background: "#FFF7E8", color: "#8A6416", fontFamily: FONT_MONO }}
      >
        Demo access — User: jane@example.com / Passw0rd!
        <br />
        Admin: admin@queuesmart.com / Passw0rd!
      </div>
    </form>
  );
}

/* ---------------------------------------------------------
   Register
--------------------------------------------------------- */
function RegisterPanel({ onRegister, goLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const rules = pwRules(password);

  function validate() {
    const e = {};
    if (!fullName.trim()) e.fullName = "Full name is required.";

    if (!email.trim()) e.email = "Email is required.";
    else if (!validEmail(email)) e.email = "Enter a valid email address.";

    if (!password) e.password = "Password is required.";
    else if (rules.some((r) => !r.pass)) e.password = "Password doesn't meet the requirements below.";

    if (!confirm) e.confirm = "Confirm your password.";
    else if (confirm !== password) e.confirm = "Passwords don't match.";

    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSubmitting(true);
    try {
      const { user, token } = await registerUser({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setErrors({});
      onRegister(user, token);
    } catch (err) {
      setErrors(err.fieldErrors && Object.keys(err.fieldErrors).length ? err.fieldErrors : { form: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Eyebrow>New account</Eyebrow>
      <h1 className="text-2xl font-semibold" style={{ color: COLORS.ink }}>
        Create your account
      </h1>
      <p className="mt-1 text-sm" style={{ color: COLORS.slate }}>
        Already have one?{" "}
        <button type="button" onClick={goLogin} className="underline font-medium" style={{ color: COLORS.ink }}>
          Log in
        </button>
      </p>

      <div className="mt-6 space-y-4">
        <Field id="reg-full-name" label="Full name" icon={UserIcon} error={errors.fullName}>
          <input
            id="reg-full-name"
            type="text"
            maxLength={100}
            aria-invalid={!!errors.fullName}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setErrors((p) => ({ ...p, fullName: undefined }));
            }}
          />
        </Field>

        <Field id="reg-email" label="Email" icon={Mail} error={errors.email}>
          <input
            id="reg-email"
            type="email"
            aria-invalid={!!errors.email}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined }));
            }}
          />
        </Field>

        <Field id="reg-phone" label="Phone (optional)" icon={Phone} error={errors.phone}>
          <input
            id="reg-phone"
            type="tel"
            maxLength={30}
            aria-invalid={!!errors.phone}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="555-0100"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((p) => ({ ...p, phone: undefined }));
            }}
          />
        </Field>

        <Field
          id="reg-password"
          label="Password"
          icon={Lock}
          error={errors.password}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{ color: COLORS.slate }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input
            id="reg-password"
            type={showPw ? "text" : "password"}
            aria-invalid={!!errors.password}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="••••••••"
            value={password}
            onFocus={() => setTouchedPw(true)}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((p) => ({ ...p, password: undefined }));
            }}
          />
        </Field>

        {touchedPw && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 -mt-2">
            {rules.map((r) => (
              <li
                key={r.label}
                className="flex items-center gap-1 text-xs"
                style={{ color: r.pass ? COLORS.greenText : COLORS.slate }}
              >
                <CheckCircle2 size={12} /> {r.label}
              </li>
            ))}
          </ul>
        )}

        <Field
          id="reg-confirm"
          label="Confirm password"
          icon={Lock}
          error={errors.confirm}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              style={{ color: COLORS.slate }}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input
            id="reg-confirm"
            type={showConfirm ? "text" : "password"}
            aria-invalid={!!errors.confirm}
            className="qs-input w-full bg-transparent text-sm py-2"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors((p) => ({ ...p, confirm: undefined }));
            }}
          />
        </Field>

        {errors.form && (
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.coral }}>
            <AlertCircle size={16} /> {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="qs-btn w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold mt-2"
          style={{ background: COLORS.ink, color: COLORS.paper, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Creating account…" : "Create account"} <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------
   Post-auth routing: admins get the admin panel, customers
   get the QueueSmart user screens
--------------------------------------------------------- */
function Dashboard({ user, token, onLogout }) {
  const isAdmin = user.role === "admin";

  if (isAdmin) {
    return <App userEmail={user.email} token={token} onLogout={onLogout} />;
  }

  return <UserApp user={user} token={token} onLogout={onLogout} />;
}
