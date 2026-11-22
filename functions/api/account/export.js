// GET /api/account/export — download everything we store about you, as a JSON file.
import { json, currentUser, db } from "../../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  const DB = await db(env);
  const u = await DB.prepare("SELECT email, name, picture, created_at, last_login FROM users WHERE id = ?").bind(user.id).first();
  const p = await DB.prepare("SELECT data FROM prefs WHERE user_id = ?").bind(user.id).first();
  const { results } = await DB.prepare("SELECT id, name, ticker, data, created_at, updated_at FROM valuations WHERE user_id = ? ORDER BY updated_at DESC").bind(user.id).all();
  const out = {
    exportedAt: new Date().toISOString(),
    account: { email: u.email, name: u.name, picture: u.picture, createdAt: new Date(u.created_at).toISOString(), lastLogin: new Date(u.last_login).toISOString() },
    settings: p ? JSON.parse(p.data) : {},
    valuations: results.map((r) => ({ id: r.id, name: r.name, ticker: r.ticker, ...JSON.parse(r.data), createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString() })),
  };
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="dcf-sandbox-my-data.json"' },
  });
}
