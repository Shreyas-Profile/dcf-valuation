// GET /api/quotes — latest price + 1-month daily closes for the home page cards.
// Runs as a Cloudflare Pages Function. Results are cached at the edge for 5 minutes
// so every visitor shares one upstream fetch.

const TICKERS = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];
const TTL_SECONDS = 300;

async function fetchTicker(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; dcf-sandbox/0.1)" } });
  if (!res.ok) throw new Error(`${ticker}: upstream ${res.status}`);
  const data = await res.json();
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error(`${ticker}: no data`);
  const closes = (r.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === "number");
  const price = r.meta?.regularMarketPrice ?? closes.at(-1);
  if (typeof price !== "number" || closes.length < 2) throw new Error(`${ticker}: incomplete data`);
  // Use the live price as the last point so the chart and the price agree.
  closes[closes.length - 1] = price;
  return {
    ticker,
    currency: r.meta?.currency || "USD",
    price: Math.round(price * 100) / 100,
    change1m: Math.round(((price - closes[0]) / closes[0]) * 1000) / 10,
    closes: closes.map((c) => Math.round(c * 100) / 100),
  };
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/quotes", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const results = await Promise.allSettled(TICKERS.map(fetchTicker));
  const quotes = results.filter((r) => r.status === "fulfilled").map((r) => r.value);

  if (quotes.length === 0) {
    return Response.json({ error: "Price data unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const res = Response.json(
    { updated: new Date().toISOString(), source: "Yahoo Finance (delayed)", quotes },
    { headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` } }
  );
  waitUntil(cache.put(key, res.clone()));
  return res;
}
