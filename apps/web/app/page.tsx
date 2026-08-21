"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApplicationStatus, AuthUser, TRANSITIONS } from "@customer-workflow/shared";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type WorkItem = {
  id: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};

type Application = {
  id: string;
  title: string;
  description: string;
  status: ApplicationStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  version: number;
  customer: { id: string; name: string; email?: string };
  assignedTo?: { name: string };
  workItems: WorkItem[];
  activities: { id: string; action: string; createdAt: string; actor: { name: string } }[];
  syncJobs: { status: string; attempts: number; lastError?: string }[];
};

type Customer = { id: string; name: string; email: string; _count: { applications: number } };

/* ── API helper ─────────────────────────────────────────────── */

async function request(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    const body = await response
      .json()
      .catch(() => ({ error: { message: "Invalid server response" } }));
    if (!response.ok)
      throw Object.assign(new Error(body.error?.message || "Request failed"), {
        status: response.status,
      });
    return body.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error("The request timed out. Please retry.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ── Icons (inline SVG) ─────────────────────────────────────── */

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconLogOut = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconActivity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconBarChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const IconTrendUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: "spin 0.7s linear infinite", display: "inline-block" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconKey = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5l3 3L22 7l-3-3" />
  </svg>
);

/* ── Badge ──────────────────────────────────────────────────── */

function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

/* ── Login / Register ───────────────────────────────────────── */

type AuthMode = "login" | "register";

// Password strength helpers
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#f43f5e" };
  if (score <= 2) return { score, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { score, label: "Good", color: "#6f2c92" };
  return { score, label: "Strong", color: "#10b981" };
}

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color } = getPasswordStrength(password);
  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="pw-strength-bar"
            style={{ background: i <= score ? color : "var(--slate-200)" }}
          />
        ))}
      </div>
      <span className="pw-strength-label" style={{ color }}>{label}</span>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("admin@workflow.local");
  const [loginPassword, setLoginPassword] = useState("demo1234");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regRole, setRegRole] = useState("EXECUTIVE");
  const [regInvite, setRegInvite] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      onLogin(await request("/auth/login", { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) }));
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    // Client-side validation
    if (regName.trim().length < 2) return setRegError("Name must be at least 2 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) return setRegError("Please enter a valid email address.");
    if (regPassword.length < 8) return setRegError("Password must be at least 8 characters.");
    if (!/[A-Z]/.test(regPassword)) return setRegError("Password must contain at least one uppercase letter.");
    if (!/[0-9]/.test(regPassword)) return setRegError("Password must contain at least one number.");
    if (regPassword !== regConfirm) return setRegError("Passwords do not match.");
    if (!regInvite.trim()) return setRegError("An invite code is required.");
    if (!agreedToTerms) return setRegError("You must agree to the terms to continue.");

    setRegLoading(true);
    try {
      onLogin(await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, confirmPassword: regConfirm, role: regRole, inviteCode: regInvite }),
      }));
    } catch (err) {
      setRegError((err as Error).message);
    } finally {
      setRegLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setLoginError("");
    setRegError("");
    setRegSuccess("");
  };

  return (
    <main className="login-shell">
      {/* ── Hero panel ── */}
      <section className="login-hero">
        <div className="hero-logo">
          <div className="hero-logo-mark">Y</div>
          <div className="hero-logo-text">
            <strong>Customer Management</strong>
            <span>Y-Axis Workspace</span>
          </div>
        </div>

        <div className="hero-body">
          <p className="hero-eyebrow">Operations Platform</p>
          <h1 className="hero-headline">
            {mode === "login" ? <>Move good<br /><em>work</em> forward.</> : <>Join the<br /><em>team</em> today.</>}
          </h1>
          <p className="hero-sub">
            {mode === "login"
              ? "A unified workspace for your team to track, manage, and resolve customer applications end-to-end."
              : "Create your account to start collaborating with your team on customer applications."}
          </p>
          <div className="hero-stats">
            <div className="hero-stat"><strong>100%</strong><span>Visibility</span></div>
            <div className="hero-stat"><strong>Real-time</strong><span>Updates</span></div>
            <div className="hero-stat"><strong>CRM</strong><span>Integrated</span></div>
          </div>
        </div>

        {/* Invite code hint panel */}
        {mode === "register" && (
          <div className="hero-invite-hint">
            <p className="hero-invite-title">Demo invite codes</p>
            <div className="hero-invite-codes">
              <div className="hero-invite-row"><code>YAXIS-ADMIN-2024</code><span>Admin</span></div>
              <div className="hero-invite-row"><code>YAXIS-MANAGER-2024</code><span>Manager</span></div>
              <div className="hero-invite-row"><code>YAXIS-EXEC-2024</code><span>Executive</span></div>
            </div>
          </div>
        )}

        <div className="hero-foot">
          <span className="signal-dot" />
          All systems operational
        </div>
      </section>

      {/* ── Form panel ── */}
      <section className="login-form-wrap">
        <div className="login-form">

          {/* Tab toggle */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === "login" ? " auth-tab-active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "register" ? " auth-tab-active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <form onSubmit={handleLogin} noValidate>
              <p className="login-form-eyebrow">Secure workspace</p>
              <h2>Welcome back.</h2>
              <p className="login-form-intro">Sign in to pick up where your team left off.</p>

              <label className="form-label">
                Email address
                <input className="field" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@company.com" autoComplete="email" required />
              </label>

              <label className="form-label">
                Password
                <div className="password-field">
                  <input className="field" type={showLoginPw ? "text" : "password"} value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••"
                    autoComplete="current-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowLoginPw(!showLoginPw)}
                    aria-label={showLoginPw ? "Hide password" : "Show password"}>
                    {showLoginPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </label>

              {loginError && <p className="form-error">{loginError}</p>}

              <button className="button primary-action" type="submit" disabled={loginLoading}>
                {loginLoading ? <><IconSpinner /> Signing in…</> : <>Sign in <IconArrowRight /></>}
              </button>

              <p className="demo-note">Demo credentials — password: <b>demo1234</b></p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === "register" && (
            <form onSubmit={handleRegister} noValidate>
              <p className="login-form-eyebrow">Join the workspace</p>
              <h2>Create account.</h2>
              <p className="login-form-intro">Fill in your details and enter your team invite code.</p>

              {/* Name + Role side by side */}
              <div className="form-row-2">
                <label className="form-label">
                  Full name
                  <input className="field" type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                    placeholder="Jane Smith" autoComplete="name" required />
                </label>
                <label className="form-label">
                  Role
                  <select className="field" value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                    <option value="EXECUTIVE">Executive</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
              </div>

              <label className="form-label">
                Work email
                <input className="field" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="you@company.com" autoComplete="email" required />
              </label>

              <label className="form-label">
                Password
                <div className="password-field">
                  <input className="field" type={showRegPw ? "text" : "password"} value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)} placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    autoComplete="new-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowRegPw(!showRegPw)}
                    aria-label={showRegPw ? "Hide password" : "Show password"}>
                    {showRegPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                <PasswordStrengthBar password={regPassword} />
              </label>

              <label className="form-label">
                Confirm password
                <div className="password-field">
                  <input className="field" type={showRegConfirm ? "text" : "password"} value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)} placeholder="Repeat your password"
                    autoComplete="new-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowRegConfirm(!showRegConfirm)}
                    aria-label={showRegConfirm ? "Hide password" : "Show password"}>
                    {showRegConfirm ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {regConfirm && regPassword !== regConfirm && (
                  <span className="field-hint field-hint-error">Passwords do not match</span>
                )}
                {regConfirm && regPassword === regConfirm && (
                  <span className="field-hint field-hint-ok">Passwords match</span>
                )}
              </label>

              <label className="form-label">
                Invite code
                <div className="invite-field">
                  <span className="invite-field-icon"><IconKey /></span>
                  <input className="field" type="text" value={regInvite} onChange={(e) => setRegInvite(e.target.value.toUpperCase())}
                    placeholder="YAXIS-XXXX-2024" autoComplete="off" required />
                </div>
                <span className="field-hint">Contact your team admin for an invite code.</span>
              </label>

              <label className="form-checkbox">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                <span>I agree to the <a href="#" tabIndex={-1}>Terms of Service</a> and <a href="#" tabIndex={-1}>Privacy Policy</a></span>
              </label>

              {regError && <p className="form-error">{regError}</p>}
              {regSuccess && <p className="form-success">{regSuccess}</p>}

              <button className="button primary-action" type="submit"
                disabled={regLoading || !agreedToTerms || regPassword !== regConfirm}>
                {regLoading ? <><IconSpinner /> Creating account…</> : <>Create account <IconArrowRight /></>}
              </button>

              <p className="demo-note">Already have an account? <button type="button" className="demo-link" onClick={() => switchMode("login")}>Sign in</button></p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

/* ── Stat card ──────────────────────────────────────────────── */

function Stat({
  label, value, detail, onClick, active, urgent, loading, variant,
}: {
  label: string; value?: number; detail: string;
  onClick: () => void; active?: boolean; urgent?: boolean; loading: boolean;
  variant?: "purple" | "emerald" | "rose";
}) {
  const variantClass = variant ? ` card-${variant}` : "";
  return (
    <button
      className={`stat-card${variantClass}${urgent ? " urgent" : ""}${active ? " stat-active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {loading ? (
        <>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-10 w-16 mt-5" />
        </>
      ) : (
        <>
          <div className="stat-top">
            <span className="stat-label">{label}</span>
            <div className="stat-icon">
              {urgent ? <IconActivity /> : <IconArrowRight />}
            </div>
          </div>
          <strong className="stat-value">{value ?? "—"}</strong>
          <span className="stat-detail">{detail}</span>
        </>
      )}
    </button>
  );
}

/* ── App row ────────────────────────────────────────────────── */

function Row({ item, onOpen }: { item: Application; onOpen: () => void }) {
  const complete = item.workItems.filter((w) => w.status === "COMPLETED").length;
  return (
    <button
      className={`app-row priority-border-${item.priority.toLowerCase()}`}
      onClick={onOpen}
      type="button"
    >
      <div className="app-main">
        <span className="app-customer">{item.customer.name}</span>
        <h3>{item.title}</h3>
        <div className="app-meta">
          <span>{item.assignedTo?.name || "Unassigned"}</span>
          <span>·</span>
          <span>{complete}/{item.workItems.length} work items</span>
        </div>
      </div>
      <div className="app-state">
        <Badge value={item.status} />
        <div className="priority-chip">
          <span className={`priority-dot priority-${item.priority.toLowerCase()}`} />
          {item.priority}
        </div>
      </div>
    </button>
  );
}

/* ── Panel wrapper ──────────────────────────────────────────── */

function Panel({ title, subtitle, close, children }: {
  title: string; subtitle?: string; close: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="detail-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="detail-header">
          <div className="detail-header-meta">
            <span className="detail-header-eyebrow">Y-Axis / Workspace</span>
            <span className="detail-header-title">Customer Management System</span>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close panel" type="button">
            <IconX />
          </button>
        </div>
        <div className="detail-body">
          {subtitle && <p className="panel-page-label">{subtitle}</p>}
          <h2 className="panel-title">{title}</h2>
          {children}
        </div>
      </aside>
    </>
  );
}

/* ── Create panel ───────────────────────────────────────────── */

function CreatePanel({ user, close, saved }: {
  user: AuthUser; close: () => void; saved: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const customers = useQuery({
    queryKey: ["create-customers"],
    queryFn: () => request("/customers") as Promise<Customer[]>,
  });

  const create = async () => {
    setError("");
    setLoading(true);
    try {
      await request("/applications", {
        method: "POST",
        body: JSON.stringify({ customerId, title, description, priority }),
      });
      saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="New application" subtitle="Create application" close={close}>
      <p className="detail-description">
        Create a customer application for your team to pick up and manage.
      </p>

      <label className="form-label">
        Customer
        <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Choose customer</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label className="form-label">
        Title
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Application title"
        />
      </label>

      <label className="form-label">
        Description
        <textarea
          className="field textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context for the team…"
        />
      </label>

      <label className="form-label">
        Priority
        <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>

      {error && <p className="form-error">{error}</p>}

      <button
        className="button primary-action"
        disabled={!customerId || !title || !description || loading}
        onClick={create}
        type="button"
      >
        {loading ? "Creating…" : <><IconPlus /> Create application</>}
      </button>
    </Panel>
  );
}

/* ── Detail panel ───────────────────────────────────────────── */

function Detail({ item, user, close, changed }: {
  item: Application; user: AuthUser; close: () => void; changed: () => void;
}) {
  const [target, setTarget] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [priority, setPriority] = useState(item.priority);
  const [workTitle, setWorkTitle] = useState("");
  const [error, setError] = useState("");

  const canManage = user.role !== "EXECUTIVE";
  const sync = item.syncJobs?.[0];

  const run = async (path: string, options?: RequestInit) => {
    try {
      await request(path, options);
      changed();
    } catch (e) {
      const err = e as Error & { status?: number };
      setError(
        err.status === 409
          ? "This application was changed elsewhere. Refresh and retry."
          : err.message
      );
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    await run(`/applications/${item.id}`, { method: "DELETE" });
    close();
  };

  const advance = (work: WorkItem) =>
    run(`/applications/${item.id}/work-items/${work.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: work.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED" }),
    });

  const addWork = async () => {
    if (!workTitle.trim()) return;
    await run(`/applications/${item.id}/work-items`, {
      method: "POST",
      body: JSON.stringify({ title: workTitle, description: "" }),
    });
    setWorkTitle("");
  };

  return (
    <Panel title={item.title} subtitle="Application detail" close={close}>
      {/* Customer card */}
      <div className="detail-customer">
        <div className="customer-avatar large">{item.customer.name[0]}</div>
        <div>
          <strong>{item.customer.name}</strong>
          <small>{item.customer.email}</small>
        </div>
      </div>

      {/* Edit mode */}
      {editing ? (
        <>
          <label className="form-label">
            Title
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="form-label">
            Description
            <textarea className="field textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="form-label">
            Priority
            <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as Application["priority"])}>
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              className="button primary-action"
              style={{ flex: 1, marginTop: 0 }}
              type="button"
              onClick={() =>
                run(`/applications/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ title, description, priority, version: item.version }),
                }).then(() => setEditing(false))
              }
            >
              Save changes
            </button>
            <button className="button" type="button" onClick={() => setEditing(false)} style={{ flexShrink: 0 }}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="detail-title-row">
          <div>
            <div className="badge-row">
              <Badge value={item.status} />
              <Badge value={item.priority} />
            </div>
            <p className="detail-description" style={{ marginBottom: 0 }}>{item.description}</p>
          </div>
          {canManage && (
            <button className="text-button" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      )}

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

      {/* Move application */}
      <section className="detail-section">
        <div className="section-heading">
          <div className="section-heading-left">
            <span className="section-number">01</span>
            <h3>Move application</h3>
          </div>
        </div>
        <div className="transition-control">
          <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose next status</option>
            {(TRANSITIONS[item.status] || []).map((next) => (
              <option key={next}>{next}</option>
            ))}
          </select>
          <button
            className="button compact"
            disabled={!target}
            type="button"
            onClick={() =>
              run(`/applications/${item.id}/status`, {
                method: "POST",
                body: JSON.stringify({ status: target, version: item.version }),
              })
            }
          >
            Update
          </button>
        </div>
      </section>

      {/* Work items */}
      <section className="detail-section">
        <div className="section-heading">
          <div className="section-heading-left">
            <span className="section-number">02</span>
            <h3>Work items</h3>
          </div>
          <span className="section-count">
            {item.workItems.filter((w) => w.status === "COMPLETED").length}/{item.workItems.length}
          </span>
        </div>

        {item.workItems.map((work) => (
          <div className="work-item" key={work.id}>
            <button
              className={`work-check ${work.status.toLowerCase()}`}
              onClick={() => advance(work)}
              aria-label={`Advance ${work.title}`}
              type="button"
            />
            <div>
              <strong>{work.title}</strong>
              <span>{work.status.replaceAll("_", " ")}</span>
            </div>
          </div>
        ))}

        <div className="add-work">
          <input
            className="field"
            value={workTitle}
            onChange={(e) => setWorkTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWork()}
            placeholder="Add a work item…"
          />
          <button className="button" type="button" onClick={addWork}>
            <IconPlus /> Add
          </button>
        </div>
      </section>

      {/* CRM sync */}
      <section className="detail-section">
        <div className="section-heading">
          <div className="section-heading-left">
            <span className="section-number">03</span>
            <h3>CRM sync</h3>
          </div>
          <Badge value={sync?.status || "NOT_STARTED"} />
        </div>
        <p className="muted-copy">Sync attempts: {sync?.attempts || 0}</p>
        {sync?.lastError && <p className="form-error" style={{ marginTop: 8 }}>{sync.lastError}</p>}
        {canManage && sync?.status === "FAILED" && (
          <button
            className="button"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => run(`/applications/${item.id}/sync/retry`, { method: "POST" })}
          >
            <IconRefresh /> Retry sync
          </button>
        )}
      </section>

      {/* Delete */}
      {canManage && (
        <button className="delete-button" type="button" onClick={remove}>
          <IconTrash /> Delete application
        </button>
      )}
    </Panel>
  );
}

/* ── Analytics ──────────────────────────────────────────────── */

type AnalyticsData = {
  byStatus: { name: string; value: number }[];
  byPriority: { name: string; value: number }[];
  byMonth: { month: string; count: number }[];
  topCustomers: { name: string; count: number }[];
  workItemStats: { total: number; completed: number; inProgress: number; pending: number; completionRate: number };
  syncHealth: { name: string; value: number }[];
  totals: { applications: number; customers: number };
};

const STATUS_COLORS: Record<string, string> = {
  "NEW": "#6f2c92", "IN PROGRESS": "#0ea5e9", "UNDER REVIEW": "#8b5cf6",
  "WAITING FOR INFO": "#f59e0b", "COMPLETED": "#10b981", "REOPENED": "#a855f7",
};
const PRIORITY_COLORS: Record<string, string> = {
  "LOW": "#94a3b8", "MEDIUM": "#0ea5e9", "HIGH": "#f59e0b", "URGENT": "#f43f5e",
};
const SYNC_COLORS: Record<string, string> = {
  "SUCCEEDED": "#10b981", "PENDING": "#f59e0b", "FAILED": "#f43f5e",
  "RETRYING": "#f97316", "NOT STARTED": "#94a3b8",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          <span>{p.name}: </span><strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

function Analytics() {
  const { data, isLoading, isError, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => request("/analytics") as Promise<AnalyticsData>,
    staleTime: 30_000,
  });

  if (isLoading) return (
    <div className="analytics-wrap">
      <header className="topbar">
        <div className="topbar-left">
          <div className="breadcrumb"><span>Operations</span><span>/</span><span>Analytics</span></div>
          <h1>Analytics</h1>
        </div>
      </header>
      <div className="analytics-grid">
        {[...Array(6)].map((_, i) => <div key={i} className="chart-card"><div className="skeleton" style={{ height: 260 }} /></div>)}
      </div>
    </div>
  );

  if (isError) return (
    <div className="analytics-wrap">
      <header className="topbar">
        <div className="topbar-left"><h1>Analytics</h1></div>
      </header>
      <div className="state" style={{ marginTop: 80 }}>
        <strong>Could not load analytics.</strong>
        <p>{(error as Error).message}</p>
        <button className="button" type="button" onClick={() => refetch()}><IconRefresh /> Retry</button>
      </div>
    </div>
  );

  if (!data) return null;
  const { byStatus, byPriority, byMonth, topCustomers, workItemStats, syncHealth } = data;

  return (
    <div className="analytics-wrap">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="breadcrumb"><span>Operations</span><span>/</span><span>Analytics</span></div>
          <h1>Analytics</h1>
        </div>
        <div className="topbar-actions">
          <button className="button" type="button" onClick={() => refetch()}>
            <IconRefresh /> Refresh
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="analytics-kpi-strip">
        <div className="kpi-card kpi-purple">
          <span className="kpi-label">Total Applications</span>
          <strong className="kpi-value">{data.totals.applications}</strong>
        </div>
        <div className="kpi-card kpi-emerald">
          <span className="kpi-label">Completed</span>
          <strong className="kpi-value">{byStatus.find(s => s.name === "COMPLETED")?.value ?? 0}</strong>
        </div>
        <div className="kpi-card kpi-sky">
          <span className="kpi-label">In Progress</span>
          <strong className="kpi-value">{byStatus.find(s => s.name === "IN PROGRESS")?.value ?? 0}</strong>
        </div>
        <div className="kpi-card kpi-rose">
          <span className="kpi-label">Urgent</span>
          <strong className="kpi-value">{byPriority.find(p => p.name === "URGENT")?.value ?? 0}</strong>
        </div>
        <div className="kpi-card kpi-amber">
          <span className="kpi-label">Work Item Completion</span>
          <strong className="kpi-value">{workItemStats.completionRate}%</strong>
        </div>
        <div className="kpi-card kpi-slate">
          <span className="kpi-label">Customers</span>
          <strong className="kpi-value">{data.totals.customers}</strong>
        </div>
      </div>

      <div className="analytics-grid">

        {/* 1. Applications by Status — Pie */}
        <div className="chart-card chart-card-wide">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Distribution</p>
              <h3 className="chart-title">Applications by Status</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStatus} cx="50%" cy="50%" outerRadius={95} innerRadius={52}
                dataKey="value" nameKey="name" paddingAngle={3} label={({ name, percent }: { name?: string; percent?: number }) =>
                  (percent ?? 0) > 0.05 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                } labelLine={false}>
                {byStatus.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Applications by Priority — Pie */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Distribution</p>
              <h3 className="chart-title">By Priority</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byPriority} cx="50%" cy="50%" outerRadius={95}
                dataKey="value" nameKey="name" paddingAngle={3}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                labelLine={false}>
                {byPriority.map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#94a3b8"} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Monthly Trend — Area Chart */}
        <div className="chart-card chart-card-full">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Trend</p>
              <h3 className="chart-title">Applications Created — Last 6 Months</h3>
            </div>
            <div className="chart-badge"><IconTrendUp /> Trend</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={byMonth} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6f2c92" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6f2c92" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="Applications" stroke="#6f2c92"
                strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: "#6f2c92", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "#6f2c92" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Top Customers — Horizontal Bar */}
        <div className="chart-card chart-card-wide">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Customers</p>
              <h3 className="chart-title">Top Customers by Applications</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCustomers} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Applications" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {topCustomers.map((_, i) => (
                  <Cell key={i} fill={`hsl(${270 + i * 18}, 55%, ${52 - i * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5. Work Items — Stacked Bar */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Workload</p>
              <h3 className="chart-title">Work Item Status</h3>
            </div>
            <span className="chart-rate-badge">{workItemStats.completionRate}% done</span>
          </div>
          <div className="work-item-donut">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={[
                  { name: "Completed", value: workItemStats.completed },
                  { name: "In Progress", value: workItemStats.inProgress },
                  { name: "Pending", value: workItemStats.pending },
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                  <Cell fill="#10b981" stroke="transparent" />
                  <Cell fill="#0ea5e9" stroke="transparent" />
                  <Cell fill="#e2e8f0" stroke="transparent" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{workItemStats.total}</strong>
              <span>total</span>
            </div>
          </div>
          <div className="work-item-legend">
            <div className="wi-legend-row"><span className="wi-dot" style={{ background: "#10b981" }} />Completed <b>{workItemStats.completed}</b></div>
            <div className="wi-legend-row"><span className="wi-dot" style={{ background: "#0ea5e9" }} />In Progress <b>{workItemStats.inProgress}</b></div>
            <div className="wi-legend-row"><span className="wi-dot" style={{ background: "#e2e8f0" }} />Pending <b>{workItemStats.pending}</b></div>
          </div>
        </div>

        {/* 6. CRM Sync Health — Pie */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <p className="chart-eyebrow">Integrations</p>
              <h3 className="chart-title">CRM Sync Health</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={syncHealth} cx="50%" cy="50%" outerRadius={90}
                dataKey="value" nameKey="name" paddingAngle={3}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                labelLine={false}>
                {syncHealth.map((entry) => (
                  <Cell key={entry.name} fill={SYNC_COLORS[entry.name] ?? "#94a3b8"} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

/* ── Customers View ─────────────────────────────────────────── */

function CustomersView() {
  const { data, isLoading, isError, error, refetch } = useQuery<Customer[]>({
    queryKey: ["customers-list"],
    queryFn: () => request("/customers") as Promise<Customer[]>,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-left">
          <div className="breadcrumb"><span>Operations</span><span>/</span><span>Customers</span></div>
          <h1>Customers</h1>
        </div>
      </header>
      <div className="queue-section">
        <div className="queue-panel">
          <div className="queue-toolbar">
            <div className="queue-toolbar-left">
              Customers
              <span className="queue-count-badge">{data?.length ?? 0}</span>
            </div>
          </div>
          {isLoading ? (
            <div className="skeleton-list"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
          ) : isError ? (
            <div className="state">
              <strong>Could not load customers.</strong>
              <p>{(error as Error).message}</p>
              <button className="button" type="button" onClick={() => refetch()}><IconRefresh /> Retry</button>
            </div>
          ) : data?.length === 0 ? (
            <div className="state"><strong>No customers found.</strong></div>
          ) : (
            data?.map((c) => (
              <div key={c.id} className="app-row" style={{ cursor: "default" }}>
                <div className="app-main">
                  <div className="customer-avatar" style={{ display: "inline-flex", marginBottom: 6 }}>{c.name[0]}</div>
                  <h3 style={{ marginBottom: 4 }}>{c.name}</h3>
                  <div className="app-meta"><span>{c.email}</span><span>·</span><span>{c._count?.applications ?? 0} applications</span></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Workspace ──────────────────────────────────────────────── */

function Workspace({ user, logout }: { user: AuthUser; logout: () => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeView, setActiveView] = useState<"applications" | "customers" | "analytics">("applications");

  const client = useQueryClient();

  const apps = useQuery({
    queryKey: ["apps", search, status, priority],
    queryFn: () =>
      request(
        `/applications?search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${priority ? `&priority=${priority}` : ""}`
      ) as Promise<Application[]>,
  });

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => request("/dashboard"),
  });

  const refresh = () => {
    client.invalidateQueries({ queryKey: ["apps"] });
    client.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const setQueue = (nextStatus: string, nextPriority = "") => {
    setStatus(nextStatus);
    setPriority(nextPriority);
    document.querySelector(".queue-panel")?.scrollIntoView({ behavior: "smooth" });
  };

  const stats = dashboard.data?.stats;

  return (
    <main className="workspace">
      {/* ── Sidebar ── */}
      <aside className="sidebar" aria-label="Main navigation">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo-mark">Y</div>
          <div className="sidebar-brand-text">
            <strong>Y-Axis</strong>
            <span>Customer Management</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <span className="sidebar-section-label">Workspace</span>

          <button
            className={`nav-item${activeView === "applications" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveView("applications")}
            aria-current={activeView === "applications" ? "page" : undefined}
          >
            <span className="nav-icon"><IconGrid /></span>
            <span className="nav-label">Applications</span>
            {apps.data && (
              <span className="nav-count">{apps.data.length}</span>
            )}
          </button>

          <button
            className={`nav-item${activeView === "customers" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveView("customers")}
            aria-current={activeView === "customers" ? "page" : undefined}
          >
            <span className="nav-icon"><IconUsers /></span>
            <span className="nav-label">Customers</span>
          </button>

          <button
            className={`nav-item${activeView === "analytics" ? " active" : ""}`}
            type="button"
            onClick={() => setActiveView("analytics")}
            aria-current={activeView === "analytics" ? "page" : undefined}
          >
            <span className="nav-icon"><IconBarChart /></span>
            <span className="nav-label">Analytics</span>
          </button>
        </nav>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="online-status">
            <span className="signal-dot" />
            <span className="online-status-text">System operational</span>
          </div>

          <div className="sidebar-divider" />

          {/* Account */}
          <div className="account-button" role="presentation">
            <div className="customer-avatar">{user.name[0]}</div>
            <div className="account-info">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </div>

          {/* Logout */}
          <button
            className="logout-button"
            type="button"
            onClick={logout}
            aria-label="Sign out"
          >
            <span className="nav-icon"><IconLogOut /></span>
            <span className="logout-label">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <section className="workspace-main">
        {activeView === "analytics" ? (
          <Analytics />
        ) : activeView === "customers" ? (
          <CustomersView />
        ) : (
          <>
            {/* Topbar */}
            <header className="topbar">
              <div className="topbar-left">
                <div className="breadcrumb">
                  <span>Operations</span>
                  <span>/</span>
                  <span>Queue</span>
                </div>
                <h1>Application queue</h1>
              </div>
              <div className="topbar-actions">
                <input
                  className="global-search"
                  placeholder="Search applications…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search applications"
                />
                {user.role !== "EXECUTIVE" && (
                  <button className="button compact" type="button" onClick={() => setCreating(true)}>
                    <IconPlus /> New application
                  </button>
                )}
              </div>
            </header>

            {/* Stats */}
            <div className="stats-section">
              <p className="stats-section-label">Overview</p>
              <div className="stats-grid">
                <Stat
                  label="Visible applications"
                  value={stats?.total}
                  detail="Clear all filters"
                  onClick={() => setQueue("")}
                  active={!status && !priority}
                  loading={dashboard.isLoading}
                  variant="purple"
                />
                <Stat
                  label="Completed"
                  value={stats?.completed}
                  detail="Show completed work"
                  onClick={() => setQueue("COMPLETED")}
                  active={status === "COMPLETED"}
                  loading={dashboard.isLoading}
                  variant="emerald"
                />
                <Stat
                  label="Urgent attention"
                  value={stats?.urgent}
                  detail="Show urgent work"
                  urgent
                  onClick={() => setQueue("", "URGENT")}
                  active={priority === "URGENT"}
                  loading={dashboard.isLoading}
                  variant="rose"
                />
              </div>
            </div>

            {/* Queue */}
            <div className="queue-section">
              <div className="content-heading">
                <div className="content-heading-left">
                  <p className="section-eyebrow">Live work</p>
                  <h2>Applications</h2>
                </div>
                <div className="filter-bar">
                  <select
                    className="filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="">All statuses</option>
                    {["NEW", "WAITING_FOR_INFO", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "REOPENED"].map((v) => (
                      <option key={v} value={v}>{v.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                  <select
                    className="filter"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    aria-label="Filter by priority"
                  >
                    <option value="">All priorities</option>
                    {["LOW", "MEDIUM", "HIGH", "URGENT"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="queue-panel">
                <div className="queue-toolbar">
                  <div className="queue-toolbar-left">
                    Applications
                    <span className="queue-count-badge">{apps.data?.length ?? 0}</span>
                  </div>
                  <span className="toolbar-note">Click a row to manage</span>
                </div>

                {apps.isLoading ? (
                  <div className="skeleton-list">
                    <div className="skeleton h-20" />
                    <div className="skeleton h-20" />
                    <div className="skeleton h-20" />
                  </div>
                ) : apps.isError ? (
                  <div className="state">
                    <strong>Could not load applications.</strong>
                    <p>{(apps.error as Error).message}</p>
                    <button className="button" type="button" onClick={() => apps.refetch()}>
                      <IconRefresh /> Retry
                    </button>
                  </div>
                ) : apps.data?.length === 0 ? (
                  <div className="state">
                    <strong>No applications found.</strong>
                    <p>Try adjusting your filters or search query.</p>
                    <button
                      className="button"
                      type="button"
                      onClick={() => { setStatus(""); setPriority(""); setSearch(""); }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  apps.data?.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      onOpen={() => {
                        setSelected(item as Application); // show instantly from cached data
                        request(`/applications/${item.id}`).then(setSelected); // refresh in background
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Panels */}
      {selected && (
        <Detail
          item={selected}
          user={user}
          close={() => setSelected(null)}
          changed={() => {
            refresh();
            request(`/applications/${selected.id}`)
              .then(setSelected)
              .catch(() => setSelected(null));
          }}
        />
      )}
      {creating && (
        <CreatePanel user={user} close={() => setCreating(false)} saved={refresh} />
      )}
    </main>
  );
}

/* ── Root ───────────────────────────────────────────────────── */

export default function Page() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    request("/auth/me").then(setUser).catch(() => undefined);
  }, []);

  if (!user) return <Login onLogin={setUser} />;

  return (
    <Workspace
      user={user}
      logout={() =>
        request("/auth/logout", { method: "POST" }).then(() => setUser(null))
      }
    />
  );
}
