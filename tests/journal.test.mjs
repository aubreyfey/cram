import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './stubs/async-storage.mjs';
import { journalDays, loadJournal, logJournal, mergeJournal, summarize, trimJournal } from '../src/lib/journal.js';

beforeEach(reset);

test('logJournal adds to the day; a rating carries its kind', async () => {
  await logJournal({ scans: 1, cards: 12 }, '2026-09-22');
  await logJournal({ rated: 1, good: 1 }, '2026-09-22');
  await logJournal({ rated: 1, again: 1 }, '2026-09-22');
  const j = await loadJournal();
  assert.deepEqual(j['2026-09-22'], { scans: 1, cards: 12, rated: 2, good: 1, again: 1 });
});

test('summarize: last n days, active days, accuracy is Got it over rated', () => {
  const j = {
    '2026-09-22': { rated: 10, good: 8, hard: 1, again: 1, scans: 2, cards: 20 },
    '2026-09-20': { rated: 10, good: 5, talks: 1, talkSeconds: 240 },
    '2026-09-01': { rated: 100, good: 100 },
    '2026-09-23': { rated: 5, good: 5 },
  };
  const w = summarize(j, 7, '2026-09-22');
  assert.equal(w.activeDays, 2, 'tomorrow and three weeks ago are out');
  assert.equal(w.rated, 20);
  assert.equal(w.accuracy, 13 / 20);
  assert.equal(w.talkSeconds, 240);
  assert.equal(summarize({}, 7, '2026-09-22').accuracy, null);
});

test('journalDays: newest first, empty days skipped', () => {
  const j = { '2026-09-20': { rated: 1 }, '2026-09-22': { scans: 1 }, '2026-09-21': {} };
  assert.deepEqual(
    journalDays(j).map((d) => d.day),
    ['2026-09-22', '2026-09-20'],
  );
});

test('mergeJournal: two phones, one day - the larger per field, never the sum', () => {
  const a = { '2026-09-22': { rated: 10, good: 8 }, '2026-09-21': { scans: 1 } };
  const b = { '2026-09-22': { rated: 12, good: 7, talks: 1 }, '2026-09-20': { rated: 3 } };
  const m = mergeJournal(a, b);
  assert.deepEqual(m['2026-09-22'], { rated: 12, good: 8, talks: 1 });
  assert.deepEqual(m['2026-09-21'], { scans: 1 });
  assert.deepEqual(m['2026-09-20'], { rated: 3 });
  assert.deepEqual(mergeJournal(undefined, undefined), {});
});

test('trimJournal keeps the newest year', () => {
  const j = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), { rated: 1 }]));
  const t = trimJournal(j);
  assert.equal(Object.keys(t).length, 366);
  assert.ok(!('2025-01-01' in t));
});
