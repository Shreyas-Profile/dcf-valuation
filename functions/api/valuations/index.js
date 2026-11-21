// GET  /api/valuations          — the signed-in user's saved valuations (newest first)
// POST /api/valuations  { id?, name, ticker, data }  — save a new one, or update one you own
import { json, sameSite, currentUser, db, randomId } from "../../../lib/auth.js";

const TICKERS = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];
const MAX_PER_USER = 50;
const MAX_DATA = 8000;

const row = (r) => ({ id: r.id, name: r.name, ticker: r.ticker, data: JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at });

export async function onRequestGet({ request, env }) {
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in to see your valuations." });
  const DB = await db(env);
  const { results } = await DB.prepare(
    "SELECT * FROM valuations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?").bind(user.id, MAX_PER_USER).all();
  return json(200, { valuations: results.map(row) });
}

export async function onRequestPost({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in to save." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Bad request." }); }
  const ticker = String(body?.ticker || "").toUpperCase();
  if (!TICKERS.includes(ticker)) return json(400, { error: "Unknown company." });
  const name = String(body?.name || "").trim().slice(0, 80) || `${ticker} valuation`;
  const data = JSON.stringify(body?.data ?? {});
  if (data.length > MAX_DATA) return json(413, { error: "That valuation is too big to save." });

  const DB = await db(env);
  const now = Date.now();
  if (body.id) {
    const res = await DB.prepare(
      "UPDATE valuations SET name = ?, ticker = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).bind(name, ticker, data, now, String(body.id), user.id).run();
    if (res.meta.changes) return json(200, { valuation: { id: String(body.id), name, ticker, updatedAt: now } });
    // not found (deleted, or someone else's): fall through and save as a new one
  }
  const count = await DB.prepare("SELECT COUNT(*) AS n FROM valuations WHERE user_id = ?").bind(user.id).first();
  if (count.n >= MAX_PER_USER) return json(409, { error: `You can save up to ${MAX_PER_USER} valuations. Delete one first.` });
  const id = randomId(12);
  await DB.prepare(
    "INSERT INTO valuations (id, user_id, name, ticker, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, user.id, name, ticker, data, now, now).run();
  return json(201, { valuation: { id, name, ticker, updatedAt: now } });
}
