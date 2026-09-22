import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckToMarkdown, guideToMarkdown } from '../src/lib/markdown.js';

test('deck: heading, subject, numbered Q/A, hint in italics, line breaks folded', () => {
  const md = deckToMarkdown({
    title: 'Chem 101',
    subject: 'Chemistry',
    cards: [
      { front: 'What is\n ATP?', back: 'Energy currency', hint: 'tri' },
      { front: 'Q2', back: 'A2' },
    ],
  });
  assert.equal(
    md,
    '# Chem 101\n*Chemistry*\n\n2 cards, made with Cram\n\n1. **What is ATP?**\n   Energy currency\n   *Hint: tri*\n2. **Q2**\n   A2\n',
  );
});

test('guide: sections, must-knows as checkboxes, optional parts omitted when empty', () => {
  const md = guideToMarkdown(
    { name: 'Chem final', date: '2026-10-01' },
    {
      overview: 'Big picture.',
      topics: [{ title: 'Bonds', summary: 'Ionic vs covalent.', mustKnow: ['Octet'] }],
      confusions: [],
      lastNight: '',
    },
  );
  assert.ok(
    md.startsWith('# Chem final - study guide\n*Exam 2026-10-01*\n\nBig picture.\n\n## Bonds\n\nIonic vs covalent.\n\n- [ ] Octet\n'),
  );
  assert.ok(!md.includes('Easy to mix up'));
  assert.ok(!md.includes('night before'));
});
