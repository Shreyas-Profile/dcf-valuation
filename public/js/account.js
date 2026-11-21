// Accounts and saved valuations (browser side).
import { loadSandbox, saveSandbox, KEYS } from "/js/sandbox.js?v=1";

const TICKERS = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];

// ----- who is signed in -----
let mePromise = null;
export function getMe(fresh = false) {
  if (!mePromise || fresh) {
    mePromise = fetch("/api/me", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => j.user || null).catch(() => null);
  }
  return mePromise;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => {});
  clearCurrent();
  mePromise = null;
}

let gisLoading = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load Google sign-in."));
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

// Draws Google's "Continue with Google" button into `el`. Calls onSignedIn(user) after a successful sign-in.
export async function googleButton(el, onSignedIn, onError = () => {}) {
  try {
    const cfg = await fetch("/api/auth/config").then((r) => r.json());
    if (!cfg.clientId) throw new Error("Sign-in isn't set up yet.");
    await loadGis();
    google.accounts.id.initialize({
      client_id: cfg.clientId,
      ux_mode: "popup",
      callback: async ({ credential }) => {
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || "Sign-in failed.");
          mePromise = Promise.resolve(j.user);
          onSignedIn(j.user);
        } catch (e) { onError(e.message); }
      },
    });
    el.innerHTML = "";
    google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "continue_with", shape: "pill", width: Math.min(320, el.clientWidth || 320) });
  } catch (e) {
    onError(e.message);
  }
}

// ----- the valuation you're working on -----
// The sliders live in localStorage per company (sandbox:T, written by the company page) and the
// chosen macro scenario in macro:T (written by the Macro page). A saved valuation is a snapshot of both.
const CUR = "current-valuation";

export function loadMacro(t) {
  try {
    const m = JSON.parse(localStorage.getItem("macro:" + t) || "null");
    return m && typeof m === "object" ? { scenario: typeof m.scenario === "string" ? m.scenario : null, strength: ["mild", "normal", "severe"].includes(m.strength) ? m.strength : "normal" } : null;
  } catch { return null; }
}
export function saveMacro(t, m) { try { localStorage.setItem("macro:" + t, JSON.stringify(m)); } catch {} }

export function getCurrent() {
  try { const c = JSON.parse(localStorage.getItem(CUR) || "null"); return c && c.id ? c : null; } catch { return null; }
}
export function setCurrent(c) { try { localStorage.setItem(CUR, JSON.stringify(c)); } catch {} }
export function clearCurrent() { try { localStorage.removeItem(CUR); } catch {} }

// Start a brand-new valuation: forget the one being edited and reset every company's sliders and scenario.
export function startNew() {
  clearCurrent();
  TICKERS.forEach((t) => { saveSandbox(t, {}); try { localStorage.removeItem("macro:" + t); } catch {} });
}

// Load a saved valuation back into the app so the user can keep working on it.
export function applyValuation(v) {
  startNew();
  const sb = v.data?.sandbox && typeof v.data.sandbox === "object" ? v.data.sandbox : {};
  const clean = {};
  [...KEYS, "waccOverride"].forEach((k) => { if (typeof sb[k] === "number" && isFinite(sb[k])) clean[k] = sb[k]; });
  saveSandbox(v.ticker, clean);
  if (v.data?.macro) saveMacro(v.ticker, v.data.macro);
  try { localStorage.setItem("lastTicker", v.ticker); } catch {}
  setCurrent({ id: v.id, name: v.name, ticker: v.ticker });
}

export function snapshot(t) {
  return { sandbox: loadSandbox(t), macro: loadMacro(t) };
}

export async function listValuations() {
  const r = await fetch("/api/valuations");
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("Couldn't load your valuations.");
  return (await r.json()).valuations;
}
export async function getValuation(id) {
  const r = await fetch("/api/valuations/" + encodeURIComponent(id));
  if (!r.ok) throw new Error("Couldn't open that valuation.");
  return (await r.json()).valuation;
}
export async function saveValuation({ id, name, ticker, data }) {
  const r = await fetch("/api/valuations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, ticker, data }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't save.");
  return j.valuation;
}
export async function deleteValuation(id) {
  const r = await fetch("/api/valuations/" + encodeURIComponent(id), { method: "DELETE" });
  if (!r.ok) throw new Error("Couldn't delete.");
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
