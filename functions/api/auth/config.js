// GET /api/auth/config — the public Google Client ID for the "Sign in with Google" button.
export const onRequestGet = ({ env }) => new Response(JSON.stringify({ clientId: env.GOOGLE_CLIENT_ID || null }), {
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
});
