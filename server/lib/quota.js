import { isAdminCode } from '../api/admin.js';
import { live, rest, userFromToken } from './supabase.js';

// Who is asking, what are they allowed, and how much have they had today.
//
// Identity, best first:
//   admin    the operator's code (x-cram-admin), checked against the env
//   user     a Supabase session (Authorization: Bearer <jwt>), verified
//            with Supabase Auth - the id is theirs, not something typed in
//   device   x-cram-device, a random id the app makes once per install.
//            A reinstall resets it; that is the ceiling of what a signed-out
//            free tier can promise, and it is still far better than the
//            per-IP guess it replaces
//   ip       nothing else to go on
//
// Tier: `pro` only when the entitlements table says so (RevenueCat's
// webhook writes it; a tester can be inserted by hand). The app's own
// x-cram-tier header is a hint for nothing - anyone can send it.
//
// Usage is one row per identity per day in `usage`, bumped after each
// request. The day is the phone's, from x-cram-tz (minutes east of UTC),
// so the free tier resets at the student's midnight like the app's own
// meter does. Without Supabase on the server none of this counts; the
// app's local meter is then the only one, as before.

export const FREE_DAILY_CARDS = 10;
export const FREE_DAILY_EXPLAINS = 3;
export const FAIR_USE_DAILY_SCANS = 60;

// Verified tokens are cached briefly so a burst of requests is one auth
// round-trip, not five.
const users = new Map();
const USER_TTL = 5 * 60_000;
const tiers = new Map();
const TIER_TTL = 60_000;

export async function identify(req) {
  const h = req.headers || {};
  if (isAdminCode(h['x-cram-admin'])) return { kind: 'admin', key: 'admin', tier: 'pro', admin: true };

  const token = (h.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token && live) {
    const user = await cachedUser(token);
    if (user) return { kind: 'user', key: `user:${user.id}`, id: user.id, tier: await tierOf(user.id) };
  }

  const device = String(h['x-cram-device'] || '').trim();
  if (/^[A-Za-z0-9_-]{8,64}$/.test(device)) return { kind: 'device', key: `device:${device}`, tier: 'free' };

  const ip = h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  return { kind: 'ip', key: `ip:${ip}`, tier: 'free' };
}

async function cachedUser(token) {
  const hit = users.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const user = await userFromToken(token).catch(() => null);
  if (user) users.set(token, { user, until: Date.now() + USER_TTL });
  if (users.size > 2000) users.clear();
  return user;
}

async function tierOf(userId) {
  const hit = tiers.get(userId);
  if (hit && hit.until > Date.now()) return hit.tier;
  let tier = 'free';
  try {
    const rows = await rest(`entitlements?user_id=eq.${userId}&select=tier,until&limit=1`);
    const e = rows?.[0];
    if (e && e.tier === 'pro' && (!e.until || new Date(e.until) > new Date())) tier = 'pro';
  } catch {
    // Store trouble should never lock a paying customer out; but it should
    // not hand out pro either. Free, and try again next minute.
  }
  tiers.set(userId, { tier, until: Date.now() + TIER_TTL });
  if (tiers.size > 5000) tiers.clear();
  return tier;
}

// YYYY-MM-DD on the phone's clock.
export function localDay(req, now = Date.now()) {
  const tz = Math.max(-840, Math.min(840, parseInt(req.headers?.['x-cram-tz'], 10) || 0));
  return new Date(now + tz * 60_000).toISOString().slice(0, 10);
}

export async function usageToday(who, req) {
  if (!live || who.admin) return { cards: 0, scans: 0, explains: 0 };
  try {
    const rows = await rest(`usage?key=eq.${encodeURIComponent(who.key)}&day=eq.${localDay(req)}&select=cards,scans,explains&limit=1`);
    return { cards: 0, scans: 0, explains: 0, ...(rows?.[0] || {}) };
  } catch {
    return { cards: 0, scans: 0, explains: 0 };
  }
}

// { ok: true } or { ok: false, error: 'quota' | 'fair_use' } - the same two
// answers the app's own checkQuota gives, so the screens need no new cases.
export async function check(who, req, { explain = false } = {}) {
  if (who.admin || !live) return { ok: true };
  const u = await usageToday(who, req);
  if (who.tier === 'pro') return u.scans >= FAIR_USE_DAILY_SCANS ? { ok: false, error: 'fair_use' } : { ok: true };
  if (explain) return u.explains >= FREE_DAILY_EXPLAINS ? { ok: false, error: 'quota' } : { ok: true };
  return u.cards >= FREE_DAILY_CARDS ? { ok: false, error: 'quota' } : { ok: true };
}

// Fire and forget: a lost bump under-counts one request, which is the
// right way to fail.
export function bump(who, req, { cards = 0, scans = 0, explains = 0 }) {
  if (!live || who.admin) return;
  rest('rpc/bump_usage', {
    method: 'POST',
    body: { p_key: who.key, p_day: localDay(req), p_cards: cards, p_scans: scans, p_explains: explains },
  }).catch((e) => console.error('usage bump failed:', e.message));
}
