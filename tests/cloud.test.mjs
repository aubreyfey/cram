import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge } from '../src/lib/cloud.js';

const DAY = 86400000;
const now = Date.now();
const card = (id, due, interval) => ({ id, front: 'q', back: 'a', srs: { due, interval } });
const ids = (xs) => xs.map((x) => x.id).sort().join(',');

const local = {
  cram: 2,
  decks: [
    { id: 'd1', title: 'Chem', createdAt: 1, cards: [card('c1', now + 3 * DAY, 3)] },
    { id: 'd2', title: 'Only here', createdAt: 2, cards: [card('c2', 0, 0)] },
  ],
  exams: [{ id: 'e1', name: 'Chem final', date: '2026-10-01' }],
  talks: [{ id: 't1', title: 'mine', uri: 'file:///a.m4a', transcript: 'x', createdAt: 5 }],
  streak: { count: 3, last: '2026-09-21' },
  deleted: { d9: now },
  profile: { name: '' },
};
const remote = {
  cram: 2,
  decks: [
    { id: 'd1', title: 'Chem (old)', createdAt: 1, cards: [card('c1', now + DAY, 3)] },
    { id: 'd3', title: 'Only remote', createdAt: 3, cards: [card('c3', 0, 0)] },
    { id: 'd9', title: 'Deleted here', createdAt: 4, cards: [card('c9', 0, 0)] },
    { id: 'd2', title: 'Deleted remotely', createdAt: 2, cards: [card('c2', 0, 0)] },
  ],
  exams: [
    { id: 'e1', name: 'Chem final (renamed)', date: '2026-10-01' },
    { id: 'e2', name: 'Bio', date: '2026-09-25' },
  ],
  talks: [
    { id: 't1', title: 'mine', transcript: 'x', createdAt: 5 },
    { id: 't2', title: 'other phone', transcript: 'y', createdAt: 6 },
  ],
  streak: { count: 10, last: '2026-09-15' },
  deleted: { d2: now - 1000 },
  profile: { name: 'Aubrey' },
};

test('decks: the copy studied more recently wins; gaps filled; tombstones from either side apply', () => {
  const m = merge(local, remote);
  assert.equal(ids(m.decks), 'd1,d3');
  assert.equal(m.decks.find((d) => d.id === 'd1').title, 'Chem');
  assert.deepEqual(Object.keys(m.deleted).sort(), ['d2', 'd9']);
});

test('exams: union, this phone wins a tie, sorted by date', () => {
  const m = merge(local, remote);
  assert.equal(ids(m.exams), 'e1,e2');
  assert.equal(m.exams[0].id, 'e2');
  assert.equal(m.exams[1].name, 'Chem final');
});

test('talks: this phone keeps its audio uri, the other transcript arrives', () => {
  const m = merge(local, remote);
  assert.equal(m.talks.find((t) => t.id === 't1').uri, 'file:///a.m4a');
  assert.equal(ids(m.talks), 't1,t2');
});

test('streak: later date wins; same day takes the higher count', () => {
  assert.deepEqual(merge(local, remote).streak, { count: 3, last: '2026-09-21' });
  const m = merge(
    { ...local, streak: { count: 2, last: '2026-09-21' } },
    { ...remote, streak: { count: 5, last: '2026-09-21' } },
  );
  assert.equal(m.streak.count, 5);
});

test('name: filled from the other phone only when empty here', () => {
  assert.equal(merge(local, remote).profile.name, 'Aubrey');
  assert.equal(merge({ ...local, profile: { name: 'Me' } }, remote).profile.name, 'Me');
});

test('a fresh phone restores everything except what was deleted', () => {
  const empty = { ...local, decks: [], exams: [], talks: [], streak: { count: 0, last: null }, deleted: {} };
  const m = merge(empty, remote);
  assert.equal(ids(m.decks), 'd1,d3,d9');
  assert.equal(m.streak.count, 10);
  assert.equal(ids(m.talks), 't1,t2');
});

test('tolerates a sparse remote row', () => {
  const m = merge({ ...local, deleted: {} }, { cram: 2 });
  assert.equal(ids(m.decks), 'd1,d2');
  assert.equal(m.profile.name, '');
});
