// Share a deck by link. POST stores a stripped copy (cards only - no
// schedule, no explanations, no pictures) under a random id and returns
// it; GET ?id= hands it back. The link is <siteUrl>/d/<id>, which the web
// build opens as a "save this deck" page, and the app opens directly.
//
// Storage is the Supabase project the app already uses, written with the
// service role from here so the anon key that ships in the app can never
// write (or list) shared decks. Needs SUPABASE_URL and
// SUPABASE_SERVICE_KEY; unset, sharing by link is simply off and the app
// says so.

import { randomBytes } from 'node:crypto';

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

const MAX = { title: 80, subject: 60, by: 40, front: 1000, back: 2000, hint: 300, cards: 300 };
const MAX_BYTES = 256 * 1024;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_LEN = 10;

// 20 links an hour per IP. A study group sharing round-robin is a handful;
// a script is not.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip)?.filter((t) => now - t < 3_600_000) ?? [];
  entry.push(now);
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.length > 20;
}

function clip(v, n) {
  return typeof v === 'string' ? v.trim().slice(0, n) : '';
}

function makeId() {
  const bytes = randomBytes(ID_LEN);
  let id = '';
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
});

export default async function handler(req, res) {
  // The web build opens links from the browser, cross-origin to this API.
  // GET is public by design (the id is the secret); POST still needs the
  // app key.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cram-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!URL || !KEY) return res.status(503).json({ error: 'not_configured' });

  if (req.method === 'GET') {
    const id = clip(req.query?.id ?? new globalThis.URL(req.url, 'http://x').searchParams.get('id'), 32);
    if (!/^[A-Za-z0-9]{6,32}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
    const r = await fetch(`${URL}/rest/v1/shared_decks?id=eq.${id}&select=deck`, { headers: headers() });
    if (!r.ok) return res.status(502).json({ error: 'store_error' });
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ deck: rows[0].deck });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (process.env.CRAM_APP_KEY && req.headers['x-cram-key'] !== process.env.CRAM_APP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  const d = req.body?.deck;
  const cards = Array.isArray(d?.cards)
    ? d.cards
        .slice(0, MAX.cards)
        .map((c) => ({ front: clip(c?.front, MAX.front), back: clip(c?.back, MAX.back), hint: clip(c?.hint, MAX.hint) || null }))
        .filter((c) => c.front && c.back)
    : [];
  if (!cards.length) return res.status(400).json({ error: 'no_cards' });

  const deck = {
    title: clip(d.title, MAX.title) || 'Shared deck',
    subject: clip(d.subject, MAX.subject) || null,
    by: clip(d.by, MAX.by) || null,
    cards,
  };
  if (JSON.stringify(deck).length > MAX_BYTES) return res.status(413).json({ error: 'too_large' });

  const id = makeId();
  const r = await fetch(`${URL}/rest/v1/shared_decks`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ id, title: deck.title, cards: cards.length, deck }),
  });
  if (!r.ok) {
    console.error('shared_decks insert failed:', r.status, await r.text().catch(() => ''));
    return res.status(502).json({ error: 'store_error' });
  }
  return res.status(200).json({ id });
}
