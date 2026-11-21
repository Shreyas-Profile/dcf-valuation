// GET /api/me — who is signed in on this device (user: null if nobody).
import { json, currentUser } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const u = await currentUser(env, request);
    return json(200, { user: u ? { email: u.email, name: u.name, picture: u.picture } : null });
  } catch {
    return json(200, { user: null, error: "Accounts are unavailable right now." });
  }
}
