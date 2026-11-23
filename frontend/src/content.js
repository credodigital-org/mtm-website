/* Runtime content layer.
   src/data.js holds the defaults. The admin panel stores only the fields that were
   changed, as a flat map  { "CONTACT_PAGE.hero.titleTop": "New text", "WHY.0.title": "…" }.
   loadContent() fetches that map and patches the live data objects *before* React renders,
   so every page keeps reading from data.js exactly as before.
   If the API is down or slow the site simply shows the defaults. */

import * as D from "./data.js";
import { API_BASE } from "./config.js";

export const ROOTS = [
  "CONTACT", "IMG", "NAV", "SERVICES", "WHY", "FOCUS", "PROCESS",
  "ABOUT_PAGE", "SERVICES_PAGE", "FOCUS_PAGE", "WHY_PAGE", "CONTACT_PAGE",
];

/* icons (lucide components) and other non-JSON things are kept by reference, never cloned or edited */
export const isOpaque = (v) => typeof v === "function" || (v && typeof v === "object" && "$$typeof" in v);

function clone(v) {
  if (isOpaque(v) || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(clone);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
}

/* untouched copy of data.js, taken before any override is applied */
export const DEFAULTS = Object.fromEntries(ROOTS.map((r) => [r, clone(D[r])]));

function setPath(tree, path, value) {
  const parts = path.split(".");
  if (parts.length < 2) return; // whole-root replacement isn't supported
  let node = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node?.[parts[i]];
    if (node === undefined || node === null || typeof node !== "object") return; // stale path: ignore
  }
  node[parts[parts.length - 1]] = value;
}

/* Values that data.js derives from other values. Recomputed after CONTACT / IMG overrides
   so that, say, changing the phone number also updates the "Contact Us" button links. */
function derive(t) {
  const C = t.CONTACT;
  const wa = String(C.whatsapp || "").replace(/\D/g, "");
  if (wa) C.whatsappLink = `https://wa.me/${wa}`;

  t.FOCUS_PAGE.cta.href = `tel:${C.tel}`;
  t.WHY_PAGE.trust.href = `tel:${C.tel}`;

  const info = t.CONTACT_PAGE.details.items;
  info[1].href = `mailto:${C.email}`;
  info[1].lines[0] = C.email;
  info[2].lines[1] = C.address;
  t.CONTACT_PAGE.map.address = C.address;

  const byTitle = { "Villa Projects": "villa", "Office Projects": "office", "General Maintenance": "maintenance" };
  t.FOCUS_PAGE.projects.forEach((p) => {
    const k = byTitle[p.title];
    if (k) p.image = t.IMG[k];
  });
}

/* Defaults + overrides -> a fresh, complete tree.
   `skip` leaves out one section's own overrides (used by the admin to get a diff baseline). */
export function buildContent(overrides = {}, skip = null) {
  const t = Object.fromEntries(ROOTS.map((r) => [r, clone(DEFAULTS[r])]));
  const mine = (p) => !(skip && (p === skip || p.startsWith(`${skip}.`)));
  const entries = Object.entries(overrides).filter(([p]) => mine(p));

  for (const [p, v] of entries) if (p.startsWith("CONTACT.") || p.startsWith("IMG.")) setPath(t, p, clone(v));
  derive(t);
  for (const [p, v] of entries) if (!(p.startsWith("CONTACT.") || p.startsWith("IMG."))) setPath(t, p, clone(v));
  return t;
}

/* ---- diff: which fields of `working` differ from `base`? -> { path: value } ---- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffSection(root, working, base) {
  const out = {};
  const walk = (a, b, p) => {
    if (isOpaque(a) || isOpaque(b)) return; // icons are never saved
    if (Array.isArray(b)) {
      const objItems = Array.isArray(a) && a.length === b.length && b.every((x) => x && typeof x === "object" && !Array.isArray(x));
      if (objItems) a.forEach((x, i) => walk(x, b[i], `${p}.${i}`));
      else if (!same(a, b)) out[p] = a;
    } else if (b && typeof b === "object") {
      for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b)])) walk(a?.[k], b[k], `${p}.${k}`);
    } else if (a !== b) {
      out[p] = a;
    }
  };
  walk(working, base, root);
  return out;
}

/* ---- patch the live data.js objects in place ---- */
function replaceInPlace(target, source) {
  if (Array.isArray(target)) {
    target.length = 0;
    source.forEach((x) => target.push(x));
  } else {
    for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
    Object.assign(target, source);
  }
}

export function applyContent(overrides) {
  if (!overrides || !Object.keys(overrides).length) return;
  const t = buildContent(overrides);
  for (const r of ROOTS) replaceInPlace(D[r], t[r]);
}

/* Fetch overrides and apply them. Never throws; gives up after `timeoutMs`. */
export async function loadContent(timeoutMs = 1500) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/api/content/`, { signal: ctl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) return;
    const { content } = await res.json();
    applyContent(content);
  } catch {
    /* offline or no API: keep defaults */
  }
}
