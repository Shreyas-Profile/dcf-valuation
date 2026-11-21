// POST /api/auth/logout — end this device's session.
import { json, sameSite, endSession, clearCookie } from "../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  try { await endSession(env, request); } catch {}
  return json(200, { ok: true }, { "Set-Cookie": clearCookie(request) });
}
