// Shared helpers for sign-in and saved valuations (used by the Pages Functions in /functions).
// This folder is outside public/, so it is bundled into the functions but never served as a file.
//
// Sign-in: the browser gets a Google ID token from "Sign in with Google" and sends it to
// /api/auth/google. We check Google's signature, then create our own session:
// a random token in an HttpOnly cookie, stored (hashed) in the D1 database.

const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
export const SESSION_DAYS = 30;
const COOKIE = "dcf_session";

export const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
});

// Only our own pages may call the APIs that change things (stops other sites using a visitor's cookie).
export function sameSite(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const h = new URL(origin).hostname;
    return h === new URL(request.url).hostname || h === "dcf.shreyas.uk" || h === "dcf-valuation.pages.dev"
      || h.endsWith(".dcf-valuation.pages.dev") || h === "localhost" || h === "127.0.0.1";
  } catch { return false; }
}

// ----- tiny base64url helpers -----
const b64urlToBytes = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function googleKeys() {
  const cache = caches.default;
  const key = new Request(GOOGLE_JWKS);
  let res = await cache.match(key);
  if (!res) {
    res = await fetch(GOOGLE_JWKS);
    if (!res.ok) throw new Error("jwks");
    const body = await res.text();
    res = new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
    await cache.put(key, res.clone());
  }
  return (await res.json()).keys || [];
}

// Returns the token's payload if it is a valid Google ID token for our app, otherwise throws.
// getKeys can be swapped out in tests.
export async function verifyGoogleToken(token, clientId, getKeys = googleKeys, now = Date.now()) {
  if (typeof token !== "string" || token.length > 4096) throw new Error("bad token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("bad alg");
  const jwk = (await getKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("bad signature");
  if (payload.aud !== clientId) throw new Error("wrong audience");
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error("wrong issuer");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now - 60_000) throw new Error("expired");
  if (!payload.sub || !payload.email || payload.email_verified !== true) throw new Error("email not verified");
  return payload;
}

// ----- database -----
let schemaReady = false;
export async function db(env) {
  if (!env.DB) throw new Error("no database");
  if (!schemaReady) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, picture TEXT,
        created_at INTEGER NOT NULL, last_login INTEGER NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS valuations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, ticker TEXT NOT NULL,
        data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS valuations_user ON valuations(user_id, updated_at)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS prefs (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    ]);
    schemaReady = true;
  }
  return env.DB;
}

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToB64url(new Uint8Array(d));
}

export const randomId = (bytes = 16) => bytesToB64url(crypto.getRandomValues(new Uint8Array(bytes)));

function readCookie(request, name) {
  const all = request.headers.get("Cookie") || "";
  for (const part of all.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const cookieAttrs = (request) => `Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;

export async function createSession(env, request, userId) {
  const DB = await db(env);
  const token = randomId(32);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86400_000;
  await DB.batch([
    DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(userId, now),
    DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), userId, now, expires),
  ]);
  return `${COOKIE}=${token}; Max-Age=${SESSION_DAYS * 86400}; ${cookieAttrs(request)}`;
}

export const clearCookie = (request) => `${COOKIE}=; Max-Age=0; ${cookieAttrs(request)}`;

// The signed-in user for this request, or null.
export async function currentUser(env, request) {
  const token = readCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const DB = await db(env);
  const row = await DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await sha256(token), Date.now()).first();
  return row || null;
}

export async function endSession(env, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return;
  const DB = await db(env);
  await DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

// ----- settings -----
const TICKERS = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];
// Only these settings are accepted; anything else is ignored.
export function cleanPrefs(p) {
  const out = {};
  if (p && (p.theme === "dark" || p.theme === "light")) out.theme = p.theme;
  if (p && TICKERS.includes(p.defaultTicker)) out.defaultTicker = p.defaultTicker;
  if (p && ["mild", "normal", "severe"].includes(p.defaultStrength)) out.defaultStrength = p.defaultStrength;
  return out;
}

// Delete everything we store about a user.
export async function deleteUser(env, userId) {
  const DB = await db(env);
  await DB.batch([
    DB.prepare("DELETE FROM valuations WHERE user_id = ?").bind(userId),
    DB.prepare("DELETE FROM prefs WHERE user_id = ?").bind(userId),
    DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
}
