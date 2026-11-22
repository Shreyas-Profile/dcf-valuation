// DELETE /api/account { confirm: "DELETE" } — delete your account and everything saved with it.
import { json, sameSite, currentUser, deleteUser, clearCookie } from "../../../lib/auth.js";

export async function onRequestDelete({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  const user = await currentUser(env, request).catch(() => null);
  if (!user) return json(401, { error: "Sign in first." });
  let body;
  try { body = await request.json(); } catch { body = null; }
  if (body?.confirm !== "DELETE") return json(400, { error: "Type DELETE to confirm." });
  await deleteUser(env, user.id);
  return json(200, { ok: true }, { "Set-Cookie": clearCookie(request) });
}
