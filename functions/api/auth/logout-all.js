// POST /api/auth/logout-all — sign out on every device (deletes all of your sessions).
import { json, sameSite, currentUser, db, clearCookie } from "../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  const DB = await db(env);
  await DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
  return json(200, { ok: true }, { "Set-Cookie": clearCookie(request) });
}
