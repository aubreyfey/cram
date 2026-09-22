import { Platform, Share } from 'react-native';
import { exportDeckFile } from './backup';
import { exportDeckMarkdown } from './markdown';
import { createShareLink } from './shareLink';
import { firstName, getProfile } from './profile';
import { alert } from './alert';

// Plain text, one Q/A pair per block. Readable in iMessage, pastes cleanly into
// Notes or a group chat, and Anki's importer picks up the "Q:"/"A:" lines with
// a single regex. A file attachment would need a share extension and would be
// wrong for the 90% case, which is texting a deck to a friend before an exam.
export function deckToText(deck, from = '') {
  const head = [deck.title, deck.subject].filter(Boolean).join(' - ');
  const body = deck.cards
    .map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`)
    .join('\n\n');
  const by = from ? ` by ${from}` : '';
  return `${head}\n${deck.cards.length} cards${by}, made with Cram\n\n${body}`;
}

export async function shareDeckText(deck) {
  try {
    const from = firstName((await getProfile()).name);
    await Share.share({ message: deckToText(deck, from), title: deck.title });
  } catch {
    // Dismissing the share sheet rejects on some platforms. Not an error.
  }
}

// A link: one tap for the friend, and it opens as a deck, not a wall of
// text. On the web the share sheet is unreliable, so the link goes to the
// clipboard instead.
export async function shareDeckLink(deck) {
  let url;
  try {
    url = await createShareLink(deck);
  } catch (e) {
    alert("Couldn't make a link", e.message);
    return;
  }
  const n = deck.cards.length;
  const line = `${deck.title} - ${n} ${n === 1 ? 'card' : 'cards'} on Cram`;
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied', `${url}\n\nAnyone with it can save the deck.`);
    } catch {
      alert('Your link', url);
    }
    return;
  }
  try {
    // iOS shares a real URL object (previews, "open in"); Android wants it in
    // the message.
    await Share.share(Platform.OS === 'ios' ? { url, message: line } : { message: `${line}\n${url}` }, { subject: line });
  } catch {
    // Dismissed.
  }
}

// A link is what a group chat wants; text pastes anywhere and needs no
// server; the file is an exact copy with hints and scheduling intact.
export function shareDeck(deck) {
  if (Platform.OS === 'web') return shareDeckLink(deck);
  alert('Share deck', null, [
    { text: 'As a link - one tap to save', onPress: () => shareDeckLink(deck) },
    { text: 'As text - paste anywhere', onPress: () => shareDeckText(deck) },
    { text: 'As Markdown - for Notes, Obsidian, Notion', onPress: () => exportDeckMarkdown(deck).catch(() => {}) },
    { text: 'As a file - opens in Cram', onPress: () => exportDeckFile(deck).catch(() => {}) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
