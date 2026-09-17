// Turns pasted text into cards with no model in the loop. Handles the
// formats students actually have on hand, tried in this order:
//
//   1. Q: question / A: answer     what "Share deck" produces, numbered or
//                                  not, multi-line answers, blank line between
//   2. one card per line, split on the first separator found:
//        term<TAB>definition       Quizlet export, spreadsheets
//        term :: definition
//        term | definition
//        term - definition         the first " - " splits, so a hyphenated
//        term = definition         word inside the term survives
//        term: definition          only when the left side is short and
//                                  is not itself a question
//   3. line pairs                  a line, then its answer on the next line;
//                                  a blank line separates cards. What you
//                                  get from typing notes in Notes.
//
// A paste that yields zero cards is a clear signal to the user; a paste that
// yields nonsense is not - so plain paragraphs still come back empty.

const QA_LINE = /^\s*(?:\d+[.)]\s*)?(q|a|question|answer)\s*[:.]\s*(.+)$/i;
const SPLITTERS = [/\t+/, /\s::\s/, /\s\|\s/, /\s[-–—]\s/, /\s=\s/];
const COLON = /:\s+/;

function clean(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function splitLine(line) {
  for (const sep of SPLITTERS) {
    const m = line.match(sep);
    if (m && m.index > 0) return [line.slice(0, m.index), line.slice(m.index + m[0].length)];
  }
  // "term: definition" - but not "Why is the sky blue?: because" style
  // questions, and not a long sentence that happens to contain a colon.
  const c = line.match(COLON);
  if (c && c.index > 0 && c.index <= 60 && !line.slice(0, c.index).includes('?')) {
    return [line.slice(0, c.index), line.slice(c.index + c[0].length)];
  }
  return null;
}

export function parseCards(text) {
  if (!text) return [];
  const lines = text.replace(/\r/g, '').split('\n');
  const cards = [];

  // Pass 1: Q/A pairs.
  let q = null;
  let a = null;
  let side = null;
  const flush = () => {
    if (q && a) cards.push({ front: clean(q), back: clean(a) });
    q = a = side = null;
  };
  let sawQA = false;
  for (const raw of lines) {
    const m = raw.match(QA_LINE);
    if (m) {
      sawQA = true;
      if (/^q/i.test(m[1])) {
        flush();
        q = m[2];
        side = 'q';
      } else {
        a = m[2];
        side = 'a';
      }
    } else if (side && raw.trim()) {
      if (side === 'q') q += ' ' + raw;
      else a += ' ' + raw;
    } else if (!raw.trim() && q && a) {
      flush();
    }
  }
  flush();
  if (sawQA) return cards;

  // Pass 2: one card per line with a separator.
  const nonBlank = lines.map((l) => l.trim()).filter(Boolean);
  for (const line of nonBlank) {
    const parts = splitLine(line);
    if (!parts) continue;
    const front = clean(parts[0]);
    const back = clean(parts[1]);
    if (front && back) cards.push({ front, back });
  }
  // If separators explain most of the lines, that is the format.
  if (cards.length && cards.length >= nonBlank.length / 2) return cards;
  cards.length = 0;

  // Pass 3: line pairs. Blocks are separated by blank lines; within a block,
  // the first line is the front and the rest is the back. A block of one
  // line has no answer and is skipped. A single block with an even number
  // of lines and no blanks is treated as alternating Q, A, Q, A.
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);

  if (blocks.length === 1 && blocks[0].length >= 2 && blocks[0].length % 2 === 0) {
    const b = blocks[0];
    for (let i = 0; i < b.length; i += 2) cards.push({ front: clean(b[i]), back: clean(b[i + 1]) });
    // A paragraph broken across lines would pair up too; only accept it if
    // the fronts look like prompts (short, or questions).
    if (cards.every((c) => c.front.length <= 120 || c.front.includes('?'))) return cards;
    return [];
  }

  for (const b of blocks) {
    if (b.length < 2) continue;
    const front = clean(b[0]);
    const back = clean(b.slice(1).join(' '));
    if (front.length > 200) continue;
    cards.push({ front, back });
  }
  return cards;
}

export function makeManualDeck({ title, subject, cards }) {
  const now = Date.now();
  return {
    id: `deck_${now}`,
    title: clean(title) || 'Untitled deck',
    subject: clean(subject || '') || null,
    createdAt: now,
    sourceKind: 'manual',
    cards: cards.map((c, i) => ({
      id: `card_${now}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}
