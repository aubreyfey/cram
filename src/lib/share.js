import { Share } from 'react-native';

// Plain text, one Q/A pair per block. Readable in iMessage, pastes cleanly into
// Notes or a group chat, and Anki's importer picks up the "Q:"/"A:" lines with
// a single regex. A file attachment would need a share extension and would be
// wrong for the 90% case, which is texting a deck to a friend before an exam.
export function deckToText(deck) {
  const head = [deck.title, deck.subject].filter(Boolean).join(' - ');
  const body = deck.cards
    .map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`)
    .join('\n\n');
  return `${head}\n${deck.cards.length} cards, made with Cram\n\n${body}`;
}

export async function shareDeck(deck) {
  try {
    await Share.share({ message: deckToText(deck), title: deck.title });
  } catch {
    // Dismissing the share sheet rejects on some platforms. Not an error.
  }
}
