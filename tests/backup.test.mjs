import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDecks } from '../src/lib/backup.js';

const DAY = 86400000;
const now = Date.now();
const deck = (id, title, due, interval, createdAt = 1) => ({
  id,
  title,
  createdAt,
  cards: [{ id: `${id}c`, front: 'q', back: 'a', srs: { due, interval } }],
});

test('an import fills gaps and never rolls progress back', () => {
  const mine = [deck('a', 'mine, studied today', now + 3 * DAY, 3)];
  const incoming = [deck('a', 'backup from last week', now - 4 * DAY, 3), deck('b', 'new', 0, 0)];
  const out = mergeDecks(mine, incoming);
  assert.equal(out.find((d) => d.id === 'a').title, 'mine, studied today');
  assert.ok(out.find((d) => d.id === 'b'));
});

test('a backup studied more recently than the phone replaces it', () => {
  const mine = [deck('a', 'stale', now - 10 * DAY, 1)];
  const incoming = [deck('a', 'fresh', now + DAY, 1)];
  assert.equal(mergeDecks(mine, incoming)[0].title, 'fresh');
});

test('result is newest-created first', () => {
  const out = mergeDecks([deck('old', 'o', 0, 0, 1)], [deck('new', 'n', 0, 0, 2)]);
  assert.deepEqual(
    out.map((d) => d.id),
    ['new', 'old'],
  );
});
