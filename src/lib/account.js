import { friendly, supabase, supabaseIsLive } from './supabase';

// The account: an email and a one-time code, no password. Optional - the
// app works fully without one. Signing in turns on cloud backup (cloud.js)
// and lets you post on the board (board.js). Both use this same session.
//
//   accountIsLive                 -> false until app.json has Supabase keys
//   getSession()                  -> { user: { id, email, name } } | null
//   signIn(email)                 -> sends a 6-digit code
//   verifyCode(email, code)       -> session
//   signOut()
//   onAuthChange(fn)              -> fn(session | null); returns unsubscribe

export const accountIsLive = supabaseIsLive;

const toUser = (u) =>
  u ? { id: u.id, email: u.email, name: u.user_metadata?.name || u.email?.split('@')[0] || 'Someone' } : null;

const toSession = (s) => {
  const user = toUser(s?.user);
  return user ? { user } : null;
};

export async function getSession() {
  if (!accountIsLive) return null;
  const { data } = await supabase().auth.getSession();
  return toSession(data.session);
}

export async function signIn(email) {
  if (!accountIsLive) throw new Error('Accounts are not available in this build.');
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(friendly(error));
}

export async function verifyCode(email, code) {
  if (!accountIsLive) throw new Error('Accounts are not available in this build.');
  const { data, error } = await supabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error) throw new Error(friendly(error));
  return toSession(data);
}

export async function signOut() {
  if (!accountIsLive) return;
  await supabase().auth.signOut();
}

export function onAuthChange(fn) {
  if (!accountIsLive) return () => {};
  const { data } = supabase().auth.onAuthStateChange((_event, session) => fn(toSession(session)));
  return () => data.subscription.unsubscribe();
}

// The session's access token, for the API to verify who is asking. Null
// when signed out; the API then counts by device instead.
export async function getAccessToken() {
  if (!accountIsLive) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token || null;
}
