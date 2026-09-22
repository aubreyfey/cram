import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RATING, deckProgress, dueCards, dueCount, schedule } from '../src/lib/srs.js';

const DAY = 86400000;
const card = (srs) => ({ id: 'c', front: 'q', back: 'a', ...(srs ? { srs } : {}) });

test('first Good: 1 day, then 3, then ease-scaled', () => {
  let c = schedule(card(), RATING.GOOD);
  assert.equal(c.srs.interval, 1);
  assert.equal(c.srs.reps, 1);
  c = schedule(c, RATING.GOOD);
  assert.equal(c.srs.interval, 3);
  c = schedule(c, RATING.GOOD);
  assert.equal(c.srs.interval, Math.round(3 * c.srs.ease));
  assert.ok(c.srs.due > Date.now() + 7 * DAY);
});

test('Again resets the streak but keeps some ease', () => {
  let c = schedule(schedule(card(), RATING.GOOD), RATING.GOOD);
  c = schedule(c, RATING.AGAIN);
  assert.equal(c.srs.reps, 0);
  assert.equal(c.srs.interval, 0);
  assert.equal(c.srs.ease, 2.5 + 0.2 - 0.2);
  assert.ok(c.srs.due <= Date.now());
});

test('ease never drops below 1.3 or rises above 3.0', () => {
  let c = card();
  for (let i = 0; i < 20; i++) c = schedule(c, RATING.AGAIN);
  assert.equal(c.srs.ease, 1.3);
  for (let i = 0; i < 20; i++) c = schedule(c, RATING.GOOD);
  assert.equal(c.srs.ease, 3.0);
});

test('Hard grows the interval slowly and never to zero', () => {
  let c = schedule(card(), RATING.HARD);
  assert.equal(c.srs.interval, 1);
  c = { ...c, srs: { ...c.srs, interval: 10 } };
  c = schedule(c, RATING.HARD);
  assert.equal(c.srs.interval, 12);
});

test('dueCards: unstudied and overdue are due; nothing due means everything', () => {
  const now = Date.now();
  const fresh = card();
  const overdue = { ...card({ ease: 2.5, interval: 1, reps: 1, due: now - DAY }), id: 'o' };
  const later = { ...card({ ease: 2.5, interval: 3, reps: 2, due: now + DAY }), id: 'l' };
  assert.deepEqual(dueCards([fresh, overdue, later]).map((c) => c.id), ['c', 'o']);
  assert.equal(dueCount([fresh, overdue, later]), 2);
  assert.deepEqual(dueCards([later]).map((c) => c.id), ['l'], 'falls back to all cards');
  assert.equal(dueCount([later]), 0);
});

test('deckProgress counts cards with two or more reps', () => {
  const learned = card({ ease: 2.5, interval: 3, reps: 2, due: 0 });
  assert.equal(deckProgress([]), 0);
  assert.equal(deckProgress([learned, card(), card(), card()]), 0.25);
});
