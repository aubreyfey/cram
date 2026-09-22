import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesAsQuestions, makeManualDeck, parseCards } from '../src/lib/parseCards.js';

const qa = (cards) => cards.map((c) => [c.front, c.back]);

test('Q:/A: blocks, numbered, with a multi-line answer', () => {
  const text = `1. Q: What is ATP?\n   A: The cell's energy currency.\n   Made in mitochondria.\n\n2. Q: Where?\n   A: Mitochondria`;
  assert.deepEqual(qa(parseCards(text)), [
    ['What is ATP?', "The cell's energy currency. Made in mitochondria."],
    ['Where?', 'Mitochondria'],
  ]);
});

test('one card per line on tab, ::, |, " - " and =', () => {
  const text = 'ATP\tenergy\nADP :: less energy\nNADH | carrier\nself-esteem - how you feel\nx = 3';
  assert.deepEqual(qa(parseCards(text)), [
    ['ATP', 'energy'],
    ['ADP', 'less energy'],
    ['NADH', 'carrier'],
    ['self-esteem', 'how you feel'],
    ['x', '3'],
  ]);
});

test('line pairs separated by blank lines', () => {
  assert.deepEqual(qa(parseCards('Mitosis\nCell division\n\nMeiosis\nGamete formation')), [
    ['Mitosis', 'Cell division'],
    ['Meiosis', 'Gamete formation'],
  ]);
});

test('plain prose yields nothing rather than nonsense', () => {
  assert.deepEqual(parseCards('The mitochondria is the powerhouse of the cell and this sentence just keeps going without any structure at all.'), []);
  assert.deepEqual(parseCards(''), []);
});

test('makeManualDeck gives ids and timestamps; linesAsQuestions makes prompts', () => {
  const deck = makeManualDeck({ title: ' Bio ', subject: '', cards: [{ front: 'a', back: 'b' }] });
  assert.ok(deck.id.startsWith('deck_'));
  assert.equal(deck.cards.length, 1);
  assert.ok(deck.cards[0].id);
  assert.ok(Array.isArray(linesAsQuestions('one\ntwo')));
});
