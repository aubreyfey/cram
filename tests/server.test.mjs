import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

// The handlers read their config at import time.
process.env.ANTHROPIC_API_KEY = 'test';
process.env.CRAM_APP_KEY = 'k';
process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'svc';

const { cleanBox } = await import('../server/api/generate.js');
const { default: share } = await import('../server/api/share.js');

// A fake Supabase REST behind global fetch: one table, in memory.
const store = new Map();
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (init.method === 'POST') {
    const row = JSON.parse(init.body);
    store.set(row.id, row);
    return { ok: true, status: 201, text: async () => '' };
  }
  const id = u.searchParams.get('id').replace('eq.', '');
  const row = store.get(id);
  return { ok: true, status: 200, json: async () => (row ? [{ deck: row.deck }] : []) };
};

// Vercel's req/res, minimally.
async function call(handler, method, { body, query, url, headers = {} } = {}) {
  const out = { code: 0, body: null, headers: {} };
  const res = {
    setHeader: (k, v) => void (out.headers[k] = v),
    status: (c) => ((out.code = c), res),
    json: (b) => ((out.body = b), res),
    end: () => res,
  };
  await handler({ method, body, query, url: url || '/api/share', headers: { 'x-cram-key': 'k', ...headers } }, res);
  return out;
}

beforeEach(() => store.clear());

test('cleanBox: good box passes, overflow is clamped, junk is rejected', () => {
  assert.deepEqual(cleanBox({ page: 1, x: 0.1, y: 0.2, w: 0.5, h: 0.3, side: 'front' }, 2), {
    page: 1, x: 0.1, y: 0.2, w: 0.5, h: 0.3, side: 'front',
  });
  const c = cleanBox({ page: 2, x: 0.8, y: 0.9, w: 0.5, h: 0.5, side: 'back' }, 2);
  assert.equal(c.w.toFixed(2), '0.20');
  assert.equal(c.h.toFixed(2), '0.10');
  assert.equal(cleanBox({ page: 3, x: 0.1, y: 0.1, w: 0.5, h: 0.5, side: 'back' }, 2), null, 'page out of range');
  assert.equal(cleanBox({ page: 1, x: 0.1, y: 0.1, w: 0.02, h: 0.5, side: 'back' }, 1), null, 'sliver');
  assert.equal(cleanBox({ page: 'a', x: 'b' }, 1), null);
  assert.equal(cleanBox({}, 1), null);
  assert.equal(cleanBox({ page: 1, x: 0, y: 0, w: 1, h: 1, side: 'top' }, 1).side, 'back');
});

test('share: POST stores a stripped copy and GET returns it without an app key', async () => {
  const deck = {
    title: '  Chem 101 ',
    subject: 'Chemistry',
    by: 'Aubrey',
    cards: [
      { front: 'Q1', back: 'A1', hint: '', srs: { due: 1 }, figure: { file: 'x' } },
      { front: '', back: 'A2' },
      { front: 'Q3', back: 'A3', hint: 'h' },
    ],
  };
  const post = await call(share, 'POST', { body: { deck } });
  assert.equal(post.code, 200);
  assert.match(post.body.id, /^[A-Za-z0-9]{10}$/);

  const stored = store.get(post.body.id);
  assert.equal(stored.deck.title, 'Chem 101');
  assert.equal(stored.cards, 2);
  assert.ok(!('srs' in stored.deck.cards[0]) && !('figure' in stored.deck.cards[0]));
  assert.equal(stored.deck.cards[0].hint, null);
  assert.equal(stored.deck.cards[1].hint, 'h');
  assert.equal(stored.deck.by, 'Aubrey');

  const get = await call(share, 'GET', { query: { id: post.body.id }, headers: {} });
  assert.equal(get.code, 200);
  assert.equal(get.body.deck.title, 'Chem 101');
  const raw = await call(share, 'GET', { url: `/api/share?id=${post.body.id}`, headers: {} });
  assert.equal(raw.code, 200, 'id from the raw url too (local.js)');
});

test('share: refusals', async () => {
  const deck = { title: 'x', cards: [{ front: 'q', back: 'a' }] };
  assert.equal((await call(share, 'GET', { query: { id: 'zzzzzzzzzz' } })).code, 404);
  assert.equal((await call(share, 'GET', { query: { id: '../x' } })).code, 400);
  assert.equal((await call(share, 'POST', { body: { deck: { title: 'x', cards: [] } } })).code, 400);
  assert.equal((await call(share, 'POST', { body: { deck }, headers: { 'x-cram-key': 'nope' } })).code, 401);
  const opt = await call(share, 'OPTIONS');
  assert.equal(opt.code, 204);
  assert.equal(opt.headers['Access-Control-Allow-Origin'], '*');
});
