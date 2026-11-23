/* Admin API client. Talks to the Django backend (API_BASE) with a JWT:
   the short-lived access token goes in the Authorization header and is renewed
   automatically with the refresh token when it expires. */
import { API_BASE } from "../config.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const ACCESS = "mtm_access_token";
const REFRESH = "mtm_refresh_token";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

export const hasSession = () => Boolean(store.get(REFRESH) || store.get(ACCESS));
export function adminLogout() {
  store.del(ACCESS);
  store.del(REFRESH);
}

/* "/admin/stats" -> "/api/admin/stats/"   ("/admin/enquiries?page=2" -> "/api/admin/enquiries/?page=2") */
function url(path) {
  const [p, q] = String(path).split("?");
  return `${API_BASE}/api${p.replace(/\/+$/, "")}/${q ? `?${q}` : ""}`;
}

let refreshing = null;
async function refreshAccess() {
  const refresh = store.get(REFRESH);
  if (!refresh) return null;
  refreshing ??= fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) { adminLogout(); return null; }
      const data = await res.json();
      store.set(ACCESS, data.access);
      if (data.refresh) store.set(REFRESH, data.refresh);
      return data.access;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function send(path, init, retry = true) {
  const token = store.get(ACCESS);
  const headers = { Accept: "application/json", ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url(path), { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. If this is the first visit in a while, wait a minute and try again.", 0);
  }
  if (res.status === 401 && retry && store.get(REFRESH)) {
    if (await refreshAccess()) return send(path, init, false);
  }
  return res;
}

export async function api(path, { method = "GET", body, form } = {}) {
  const init = { method, headers: {} };
  if (form) {
    init.body = form; // FormData: the browser sets the multipart header
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["Content-Type"] = "application/json";
  }
  const res = await send(path, init);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401) {
      adminLogout();
      window.dispatchEvent(new Event("admin-unauthorized"));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/* sign in with the e-mail address and password; resolves to the user */
export async function adminLogin(email, password) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: email.trim().toLowerCase(), password }),
    });
  } catch {
    throw new ApiError("Can't reach the server. If this is the first visit in a while, wait a minute and try again.", 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data?.error || "Wrong email or password", res.status);
  store.set(ACCESS, data.access);
  store.set(REFRESH, data.refresh);
  try {
    return (await api("/auth/me")).user;
  } catch (err) {
    adminLogout(); // signed in, but not an admin account
    throw err;
  }
}

/* download the enquiries CSV (a plain link can't carry the login token) */
export async function downloadEnquiriesCsv() {
  const res = await send("/admin/enquiries/export", { method: "GET", headers: {} });
  if (!res.ok) throw new ApiError("Couldn't export the enquiries", res.status);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- small shared helpers ---------- */
export function parseDate(s) {
  const t = String(s);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t.replace(" ", "T") + "Z"); // ISO from the API; bare values are UTC
}

export function timeAgo(s) {
  const d = parseDate(s);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fullDate(s) {
  return parseDate(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const STATUS_LABEL = { new: "New", in_progress: "In progress", done: "Done", spam: "Spam" };

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
