import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = 'test';
process.env.CRAM_ADMIN_KEY = 'admin-secret';
process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'svc';

const { identify, check, bump, localDay, FREE_DAILY_CARDS, FAIR_USE_DAILY_SCANS } = await import('../server/lib/quota.js');

// Fake Supabase: auth/v1/user knows one token; usage and entitlements are
// in-memory tables; the rpc bumps.
const usage = new Map();
const entitlements = new Map();
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  calls.push(u.pathname);
  const json = (v, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(v), json: async () => v });
  if (u.pathname === '/auth/v1/user') {
    const token = (init.headers.Authorization || '').replace('Bearer ', '');
    return token === 'good-token' ? json({ id: 'user-1', email: 'a@b.c' }) : json({ error: 'bad' }, 401);
  }
  if (u.pathname === '/rest/v1/entitlements') {
    const id = u.searchParams.get('user_id').replace('eq.', '');
    return json(entitlements.has(id) ? [entitlements.get(id)] : []);
  }
  if (u.pathname === '/rest/v1/usage') {
    const key = decodeURIComponent(u.searchParams.get('key').replace('eq.', ''));
    const day = u.searchParams.get('day').replace('eq.', '');
    const row = usage.get(`${key}|${day}`);
    return json(row ? [row] : []);
  }
  if (u.pathname === '/rest/v1/rpc/bump_usage') {
    const b = JSON.parse(init.body);
    const k = `${b.p_key}|${b.p_day}`;
    const row = usage.get(k) || { cards: 0, scans: 0, explains: 0 };
    usage.set(k, { cards: row.cards + b.p_cards, scans: row.scans + b.p_scans, explains: row.explains + b.p_explains });
    return json(null, 204);
  }
  return json({ error: 'unexpected ' + u.pathname }, 500);
};

const req = (headers = {}) => ({ headers });
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => {
  usage.clear();
  entitlements.clear();
  calls.length = 0;
});

test('identify: admin, then verified user, then device, then ip', async () => {
  assert.equal((await identify(req({ 'x-cram-admin': 'admin-secret' }))).kind, 'admin');
  const user = await identify(req({ authorization: 'Bearer good-token' }));
  assert.deepEqual([user.kind, user.key, user.tier], ['user', 'user:user-1', 'free']);
  const bad = await identify(req({ authorization: 'Bearer nope', 'x-cram-device': 'dev12345678' }));
  assert.equal(bad.key, 'device:dev12345678', 'a bad token falls through to the device');
  assert.equal((await identify(req({ 'x-cram-device': 'short' }))).kind, 'ip', 'a malformed device id is ignored');
  assert.equal((await identify(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).key, 'ip:1.2.3.4');
});

test('tier comes from entitlements, not the header', async () => {
  const forged = await identify(req({ authorization: 'Bearer good-token', 'x-cram-tier': 'pro' }));
  assert.equal(forged.tier, 'free');
  entitlements.set('user-2', { tier: 'pro', until: null });
  // A different user so the tier cache from the line above does not apply.
  globalThis.fetch = ((orig) => async (url, init) => {
    if (new URL(url).pathname === '/auth/v1/user' && init.headers.Authorization === 'Bearer token-2') {
      return { ok: true, status: 200, json: async () => ({ id: 'user-2' }), text: async () => '' };
    }
    return orig(url, init);
  })(globalThis.fetch);
  assert.equal((await identify(req({ authorization: 'Bearer token-2' }))).tier, 'pro');
  entitlements.set('user-2', { tier: 'pro', until: '2000-01-01T00:00:00Z' });
  // Cached for a minute; that is by design, so this asserts the cache, not expiry.
  assert.equal((await identify(req({ authorization: 'Bearer token-2' }))).tier, 'pro');
});

test('free tier: the wall comes down at 10 cards, explains at 3', async () => {
  const who = await identify(req({ 'x-cram-device': 'dev12345678' }));
  const r = req({ 'x-cram-device': 'dev12345678' });
  assert.deepEqual(await check(who, r), { ok: true });
  bump(who, r, { cards: FREE_DAILY_CARDS - 1, scans: 1 });
  await tick();
  assert.deepEqual(await check(who, r), { ok: true }, 'one card left');
  bump(who, r, { cards: 1, scans: 1 });
  await tick();
  assert.deepEqual(await check(who, r), { ok: false, error: 'quota' });
  assert.deepEqual(await check(who, r, { explain: true }), { ok: true }, 'explains are a separate meter');
  bump(who, r, { explains: 3 });
  await tick();
  assert.deepEqual(await check(who, r, { explain: true }), { ok: false, error: 'quota' });
});

test('pro: no card wall, fair use at 60 scans; admin: never', async () => {
  const pro = { kind: 'user', key: 'user:p', tier: 'pro' };
  const r = req({});
  bump(pro, r, { cards: 500, scans: FAIR_USE_DAILY_SCANS - 1 });
  await tick();
  assert.deepEqual(await check(pro, r), { ok: true });
  bump(pro, r, { cards: 1, scans: 1 });
  await tick();
  assert.deepEqual(await check(pro, r), { ok: false, error: 'fair_use' });
  const admin = await identify(req({ 'x-cram-admin': 'admin-secret' }));
  bump(admin, r, { cards: 9999, scans: 9999 });
  await tick();
  assert.deepEqual(await check(admin, r), { ok: true });
  assert.ok(!calls.includes('/rest/v1/rpc/bump_usage') || usage.size === 1, 'admin is never counted');
});

test('the day is the phone\'s: tz offset shifts it, clamped to +-14h', () => {
  const noonUtc = Date.UTC(2026, 8, 22, 23, 30);
  assert.equal(localDay(req({ 'x-cram-tz': '0' }), noonUtc), '2026-09-22');
  assert.equal(localDay(req({ 'x-cram-tz': '60' }), noonUtc), '2026-09-23', 'Paris is already tomorrow');
  assert.equal(localDay(req({ 'x-cram-tz': '-420' }), noonUtc), '2026-09-22');
  assert.equal(localDay(req({ 'x-cram-tz': '99999' }), noonUtc), '2026-09-23', 'clamped, not a time machine');
  assert.equal(localDay(req({}), noonUtc), '2026-09-22');
});
