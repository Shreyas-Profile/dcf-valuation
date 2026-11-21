// POST /api/auth/google  { credential }  — sign in (or sign up) with a Google ID token.
import { json, sameSite, verifyGoogleToken, db, createSession } from "../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!sameSite(request)) return json(403, { error: "forbidden" });
  if (!env.GOOGLE_CLIENT_ID) return json(503, { error: "Sign-in isn't set up yet." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Bad request." }); }
  let g;
  // Local testing only: TEST_JWKS (in .dev.vars) lets tests sign their own tokens. Ignored on the real site.
  const host = new URL(request.url).hostname;
  const testKeys = env.TEST_JWKS && (host === "localhost" || host === "127.0.0.1") ? () => JSON.parse(env.TEST_JWKS).keys : undefined;
  try { g = await verifyGoogleToken(body?.credential, env.GOOGLE_CLIENT_ID, testKeys); }
  catch { return json(401, { error: "Google sign-in failed. Try again." }); }

  const DB = await db(env);
  const now = Date.now();
  const name = String(g.name || g.email).slice(0, 100);
  const picture = typeof g.picture === "string" && g.picture.startsWith("https://") ? g.picture.slice(0, 500) : null;
  await DB.prepare(
    `INSERT INTO users (id, email, name, picture, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_login = excluded.last_login`
  ).bind(g.sub, g.email, name, picture, now, now).run();
  const cookie = await createSession(env, request, g.sub);
  return json(200, { user: { email: g.email, name, picture } }, { "Set-Cookie": cookie });
}
