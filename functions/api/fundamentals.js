// GET /api/fundamentals — the 4 numbers Arush's Excel pulls live (Stocks data type):
// market cap, shares outstanding, beta, and the risk-free rate (US 10-year Treasury yield).
// Also returns the latest share price so the app can compare it to the intrinsic value.
// Cached at the edge for 30 minutes. Any field that can't be fetched is simply left out,
// and the page falls back to the value saved in Arush's spreadsheet.

const TICKERS = ["MSFT", "GOOG", "AAPL", "META", "NVDA"];
const TTL_SECONDS = 1800;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function chartPrice(symbol) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${symbol}: ${res.status}`);
  const data = await res.json();
  const p = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof p !== "number") throw new Error(`${symbol}: no price`);
  return p;
}

// Yahoo's quote endpoint needs a session cookie + "crumb" token.
async function quoteBatch(symbols) {
  const first = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA }, redirect: "manual" });
  const raw = typeof first.headers.getSetCookie === "function" ? first.headers.getSetCookie() : [first.headers.get("set-cookie") || ""];
  const cookie = raw.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  if (!cookie) throw new Error("no cookie");
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: cookie } });
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.includes("<")) throw new Error("no crumb");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=marketCap,sharesOutstanding,impliedSharesOutstanding,beta,regularMarketPrice&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie } });
  if (!res.ok) throw new Error(`quote: ${res.status}`);
  const data = await res.json();
  return data?.quoteResponse?.result || [];
}

const num = (x) => (typeof x === "number" && isFinite(x) && x > 0 ? x : undefined);

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/fundamentals", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const [rf, quotes, ...prices] = await Promise.allSettled([
    chartPrice("^TNX"),
    quoteBatch(TICKERS),
    ...TICKERS.map(chartPrice),
  ]);

  const companies = {};
  TICKERS.forEach((t, i) => {
    const q = quotes.status === "fulfilled" ? quotes.value.find((x) => x.symbol === t) : undefined;
    const price = num(q?.regularMarketPrice) ?? (prices[i].status === "fulfilled" ? prices[i].value : undefined);
    const shares = num(q?.impliedSharesOutstanding) ?? num(q?.sharesOutstanding);
    const entry = {
      price,
      marketCap: num(q?.marketCap) !== undefined ? q.marketCap / 1e6 : undefined, // USD millions, like the Excel
      shares: shares !== undefined ? shares / 1e6 : undefined,
      beta: num(q?.beta),
    };
    // Drop missing fields so the page knows to use Arush's saved value.
    companies[t] = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
  });

  const body = {
    updated: new Date().toISOString(),
    source: "Yahoo Finance (delayed)",
    riskFree: rf.status === "fulfilled" ? rf.value / 100 : undefined,
    companies,
  };
  const anything = body.riskFree !== undefined || Object.values(companies).some((c) => Object.keys(c).length);
  if (!anything) {
    return Response.json({ error: "Live data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const res = Response.json(body, { headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
