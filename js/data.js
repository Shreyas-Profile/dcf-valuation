// Shared loader for the Macro, Analysis and More pages.
// Same rules as the company page: live numbers where Yahoo has them, otherwise the values saved in the spreadsheet.

export const ORDER = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];

export const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
export const signedPct = (x, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(d) + "%";
export const usd = (x) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (x) => (x >= 10000 ? "$" + (x / 1000).toFixed(1) + "k" : "$" + Math.round(x).toLocaleString("en-US"));

const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

export async function loadAll() {
  const [modelsRes, liveRes, quotesRes] = await Promise.allSettled([
    json("/data/models.json?v=3"),
    json("/api/fundamentals"),
    json("/api/quotes"),
  ]);
  if (modelsRes.status !== "fulfilled") throw new Error("models");
  const api = liveRes.status === "fulfilled" ? liveRes.value : null;
  const quotes = quotesRes.status === "fulfilled" ? quotesRes.value : null;

  const companies = {};
  for (const t of ORDER) {
    const model = modelsRes.value.companies[t];
    if (!model) continue;
    const c = api?.companies?.[model.liveTicker] || {};
    const isLive = {};
    const pick = (k, v) => { isLive[k] = typeof v === "number" && isFinite(v) && v > 0; return isLive[k] ? v : model.savedLive[k]; };
    const live = {
      marketCap: pick("marketCap", c.marketCap),
      shares: pick("shares", c.shares),
      beta: pick("beta", c.beta),
      riskFree: pick("riskFree", api?.riskFree),
    };
    const price = quotes?.quotes?.find((q) => q.ticker === model.ticker)?.price ?? c.price ?? null;
    companies[t] = { model, live, isLive, price };
  }
  return { companies, api, author: modelsRes.value.author };
}

// The company the user last looked at, so the nav can take them back to it.
export function rememberTicker(t) { try { localStorage.setItem("lastTicker", t); } catch {} }
export function lastTicker() {
  const q = (new URLSearchParams(location.search).get("t") || "").toUpperCase();
  if (ORDER.includes(q)) return q;
  try { const s = localStorage.getItem("lastTicker"); if (ORDER.includes(s)) return s; } catch {}
  return "MSFT";
}

// Point the bottom nav's Base / Sandbox / Macro links at the current company.
export function wireNav(ticker) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const k = a.dataset.nav;
    if (k === "base" || k === "sandbox") a.href = `/company?t=${ticker}#${k}`;
    if (k === "macro") a.href = `/macro?t=${ticker}`;
  });
}
