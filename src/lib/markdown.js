import { shareTextFile } from './backup';

// Decks and study guides as Markdown: the format Notes, Obsidian, Notion
// and every other notes app open without asking. A deck is a heading and
// a question/answer list; a guide is the guide, as written. Nothing here
// round-trips back into Cram - that is what the .cram.json file is for.

const MD = 'text/markdown';
const UTI = 'net.daringfireball.markdown';

function safeName(s) {
  return (s || 'deck').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'deck';
}

// Line breaks inside a card would break the list; fold them.
const one = (s) => (s || '').replace(/\s*\n+\s*/g, ' ').trim();

export function deckToMarkdown(deck) {
  const head = [`# ${one(deck.title) || 'Deck'}`, deck.subject ? `*${one(deck.subject)}*` : null, ''].filter((l) => l !== null);
  const cards = deck.cards.map((c, i) => {
    const lines = [`${i + 1}. **${one(c.front)}**`, `   ${one(c.back)}`];
    if (c.hint) lines.push(`   *Hint: ${one(c.hint)}*`);
    return lines.join('\n');
  });
  return [...head, `${deck.cards.length} cards, made with Cram`, '', ...cards, ''].join('\n');
}

export function guideToMarkdown(exam, guide) {
  const out = [`# ${one(exam.name)} - study guide`, exam.date ? `*Exam ${exam.date}*` : null, '', guide.overview, ''];
  for (const t of guide.topics || []) {
    out.push(`## ${one(t.title)}`, '', t.summary, '');
    for (const m of t.mustKnow || []) out.push(`- [ ] ${one(m)}`);
    out.push('');
  }
  if (guide.confusions?.length) {
    out.push('## Easy to mix up', '');
    for (const c of guide.confusions) out.push(`- ${one(c)}`);
    out.push('');
  }
  if (guide.lastNight) out.push('## The night before', '', guide.lastNight, '');
  return out.filter((l) => l !== null).join('\n');
}

export async function exportDeckMarkdown(deck) {
  await shareTextFile(`${safeName(deck.title)}.md`, deckToMarkdown(deck), MD, UTI);
}

export async function exportGuideMarkdown(exam, guide) {
  await shareTextFile(`${safeName(exam.name)} - study guide.md`, guideToMarkdown(exam, guide), MD, UTI);
}
