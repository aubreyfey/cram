// Turns pasted text into cards with no model in the loop. Handles the
// formats students actually have on hand:
//
//   Q: question            <- what "Share deck" produces, with or without
//   A: answer                 the "1." numbering; blank line between cards
//
//   term<TAB>definition     <- Quizlet export, spreadsheets
//   term :: definition
//   term - definition       <- notes; the first " - " splits, so a hyphenated
//                             word inside the term survives
//
// Lines that fit none of these are ignored rather than guessed at. A paste
// that yields zero cards is a clear signal to the user; a paste that yields
// nonsense is not.

const QA_LINE = /^\s*(?:\d+[.)]\s*)?(q|a|question|answer)\s*[:.]\s*(.+)$/i;
const SPLITTERS = [/\t+/, /\s::\s/, /\s[-–—]\s/];

function clean(s) {
  return s.replace(/\s+/g, ' ').trim();
}

export function parseCards(text) {
  if (!text) return [];
  const lines = text.replace(/\r/g, '').split('\n');
  const cards = [];

  // Pass 1: Q/A pairs. A question line followed (possibly after blank or
  // continuation lines) by an answer line. Continuation lines extend
  // whichever side is open.
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
      const isQ = /^q/i.test(m[1]);
      if (isQ) {
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
    } else if (!raw.trim()) {
      // Blank line ends the current card, if it has both halves.
      if (q && a) flush();
    }
  }
  flush();
  if (sawQA) return cards;

  // Pass 2: one card per line, split on the first recognised separator.
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    for (const sep of SPLITTERS) {
      const m = line.match(sep);
      if (m && m.index > 0) {
        const front = clean(line.slice(0, m.index));
        const back = clean(line.slice(m.index + m[0].length));
        if (front && back) cards.push({ front, back });
        break;
      }
    }
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
