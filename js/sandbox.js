// Sandbox settings shared between the company page (where the sliders are) and the Macro page.
// Only the sliders the user actually moved are saved, so everything else keeps following the
// base case (and today's live numbers).
import { line } from "/js/dcf.js?v=2";

export const KEYS = ["growthStart", "growthStep", "ebitMargin", "daPct", "capexStart", "capexStep", "tax", "riskFree", "beta", "erp", "terminalGrowth"];

export function sandboxBase(model, live) {
  const d = model.drivers;
  return {
    growthStart: d.growth[0], growthStep: d.growth[1] - d.growth[0],
    ebitMargin: d.ebitMargin[0], daPct: d.daPct[0],
    capexStart: d.capexPct[0], capexStep: d.capexPct[1] - d.capexPct[0],
    tax: d.tax[0], riskFree: live.riskFree, beta: live.beta,
    erp: model.rates.erp, terminalGrowth: model.rates.terminalGrowth,
  };
}

// saved = { someKey: value, ..., waccOverride?: number }  →  inputs for runDcf
export function sandboxChanges(model, live, saved = {}) {
  const b = sandboxBase(model, live);
  const has = (k) => typeof saved[k] === "number" && isFinite(saved[k]);
  const v = (k) => (has(k) ? saved[k] : b[k]);
  const ch = { drivers: {} };
  if (has("growthStart") || has("growthStep")) ch.drivers.growth = line(v("growthStart"), v("growthStep"));
  if (has("ebitMargin")) ch.drivers.ebitMargin = line(v("ebitMargin"), 0);
  if (has("daPct")) ch.drivers.daPct = line(v("daPct"), 0);
  if (has("capexStart") || has("capexStep")) ch.drivers.capexPct = line(v("capexStart"), v("capexStep")).map((x) => Math.max(0, x));
  if (has("tax")) ch.drivers.tax = line(v("tax"), 0);
  if (has("erp")) ch.erp = v("erp");
  if (has("waccOverride")) ch.wacc = saved.waccOverride;
  if (has("terminalGrowth")) ch.terminalGrowth = v("terminalGrowth");
  return { ch, runLive: { ...live, riskFree: v("riskFree"), beta: v("beta") } };
}

const storeKey = (t) => "sandbox:" + t;

export function loadSandbox(ticker) {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(ticker)) || "null");
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const k of [...KEYS, "waccOverride"]) if (typeof raw[k] === "number" && isFinite(raw[k])) out[k] = raw[k];
    return out;
  } catch { return {}; }
}

export function saveSandbox(ticker, saved) {
  try {
    if (Object.keys(saved).length) localStorage.setItem(storeKey(ticker), JSON.stringify(saved));
    else localStorage.removeItem(storeKey(ticker));
  } catch {}
}

export const hasSandbox = (saved) => Object.keys(saved).length > 0;
