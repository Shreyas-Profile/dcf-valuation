// GET /api/settings — your saved preferences
// PUT /api/settings { theme?, defaultTicker?, defaultStrength? } — save them
import { json, sameSite, currentUser, db, cleanPrefs } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  const DB = await db(env);
  const row = await DB.prepare("SELECT data FROM prefs WHERE user_id = ?").bind(user.id).first();
  return json(200, { prefs: row ? cleanPrefs(JSON.parse(row.data)) : {} });
}

export async function onRequestPut({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Bad request." }); }
  const prefs = cleanPrefs(body);
  const DB = await db(env);
  await DB.prepare(
    `INSERT INTO prefs (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, JSON.stringify(prefs), Date.now()).run();
  return json(200, { prefs });
}
