// Supabase from the server, with the service role. One place for the
// URL, the key, and "is it configured at all" - every feature that needs
// the database (shared decks, usage, entitlements) checks `live` and
// degrades quietly when it is false.

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

export const live = !!(URL && KEY);

const base = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

// PostgREST. `path` is everything after /rest/v1/, query string included.
// Throws on a non-2xx so callers can decide whether that is fatal.
export async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...base(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`supabase ${method} ${path.split('?')[0]} -> ${r.status} ${text.slice(0, 200)}`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// Who does this user token belong to? Supabase Auth checks the signature
// and expiry; we just ask. Null for a bad, expired or missing token.
export async function userFromToken(token) {
  if (!token) return null;
  const r = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id ? { id: u.id, email: u.email } : null;
}
