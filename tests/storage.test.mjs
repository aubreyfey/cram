import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './stubs/async-storage.mjs';
import {
  deleteDeck,
  deleteExam,
  loadDecks,
  loadDeleted,
  loadExams,
  onChange,
  saveDeck,
  saveExam,
  trimDeleted,
} from '../src/lib/storage.js';

beforeEach(reset);

test('saveDeck upserts to the front; deleteDeck leaves a tombstone', async () => {
  await saveDeck({ id: 'a', title: 'A', cards: [] });
  await saveDeck({ id: 'b', title: 'B', cards: [] });
  await saveDeck({ id: 'a', title: 'A2', cards: [] });
  assert.deepEqual((await loadDecks()).map((d) => d.id), ['a', 'b']);
  assert.equal((await loadDecks())[0].title, 'A2');
  await deleteDeck('a');
  assert.deepEqual((await loadDecks()).map((d) => d.id), ['b']);
  assert.ok((await loadDeleted()).a > 0);
});

test('exams sort by date and tombstone on delete', async () => {
  await saveExam({ id: 'x', name: 'Later', date: '2026-12-01' });
  await saveExam({ id: 'y', name: 'Sooner', date: '2026-10-01' });
  assert.deepEqual((await loadExams()).map((e) => e.id), ['y', 'x']);
  await deleteExam('y');
  assert.ok((await loadDeleted()).y);
});

test('every write notifies; the listener can unsubscribe', async () => {
  let n = 0;
  const off = onChange(() => n++);
  await saveDeck({ id: 'a', cards: [] });
  await saveExam({ id: 'e', date: '2026-10-01' });
  await deleteDeck('a');
  assert.equal(n, 3);
  off();
  await saveDeck({ id: 'b', cards: [] });
  assert.equal(n, 3);
});

test('trimDeleted keeps the newest 500', () => {
  const big = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`id${i}`, i]));
  const t = trimDeleted(big);
  assert.equal(Object.keys(t).length, 500);
  assert.ok(!('id0' in t) && 'id599' in t);
});
