import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckFromShared, parseShareUrl } from '../src/lib/shareLink.js';

test('parseShareUrl accepts our links and nothing else', () => {
  for (const u of [
    'https://cram.vercel.app/d/abcDEF2345',
    'https://cram.vercel.app/d/abcDEF2345/',
    'https://cram.vercel.app/d/abcDEF2345?utm=x#y',
    'cram://d/abcDEF2345',
    'cram:///d/abcDEF2345',
    'http://localhost:8081/d/abcDEF2345',
  ]) {
    assert.equal(parseShareUrl(u), 'abcDEF2345', u);
  }
  for (const u of [
    'https://cram.vercel.app/',
    'https://youtu.be/d/abc',
    'https://cram.vercel.app/d/ab',
    'https://cram.vercel.app/d/abc$def123',
    undefined,
    42,
  ]) {
    assert.equal(parseShareUrl(u), null, String(u));
  }
});

test('deckFromShared makes a fresh deck with its own ids and no schedule', () => {
  const d = deckFromShared({
    title: 'T',
    subject: 'S',
    by: 'Aubrey',
    cards: [
      { front: 'q', back: 'a', hint: '' },
      { front: 'q2', back: 'a2', hint: 'h' },
    ],
  });
  assert.ok(d.id.startsWith('deck_'));
  assert.equal(d.sourceKind, 'shared');
  assert.equal(d.sharedBy, 'Aubrey');
  assert.equal(d.cards.length, 2);
  assert.notEqual(d.cards[0].id, d.cards[1].id);
  assert.equal(d.cards[0].hint, null);
  assert.equal(d.cards[1].hint, 'h');
  assert.ok(!('srs' in d.cards[0]));
});
