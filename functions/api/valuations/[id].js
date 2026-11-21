// GET    /api/valuations/:id — one saved valuation (only your own)
// DELETE /api/valuations/:id — delete it
import { json, sameSite, currentUser, db } from "../../../lib/auth.js";

export async function onRequestGet({ request, env, params }) {
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  const DB = await db(env);
  const r = await DB.prepare("SELECT * FROM valuations WHERE id = ? AND user_id = ?").bind(String(params.id), user.id).first();
  if (!r) return json(404, { error: "Not found." });
  return json(200, { valuation: { id: r.id, name: r.name, ticker: r.ticker, data: JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at } });
}

export async function onRequestDelete({ request, env, params }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  const DB = await db(env);
  const res = await DB.prepare("DELETE FROM valuations WHERE id = ? AND user_id = ?").bind(String(params.id), user.id).run();
  return res.meta.changes ? json(200, { ok: true }) : json(404, { error: "Not found." });
}
