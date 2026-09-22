import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { loadDecks } from './storage';

// The file backup. Signed in, cloud.js keeps a copy on the account; this is
// the way that needs no account: export everything to Files / iCloud Drive
// / an email to yourself, import it back on a new phone. The same format
// carries a single deck between friends with every hint intact, which
// pasted text can't.
//
// File shape, versioned so a future import can migrate:
//   { cram: 1, exportedAt, decks: [deck, ...] }

const FORMAT = 1;

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(s) {
  return (s || 'deck').replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'deck';
}

function serialise(decks) {
  return JSON.stringify({ cram: FORMAT, exportedAt: Date.now(), decks }, null, 1);
}

// Hands the JSON to the share sheet (native) or triggers a download (web).
// Also used for Markdown (markdown.js): same share sheet, different type.
export async function shareTextFile(name, text, mimeType = 'application/json', UTI = 'public.json') {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name);
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI,
    dialogTitle: name,
  });
}

export async function exportBackup() {
  const decks = await loadDecks();
  await shareTextFile(`cram-backup-${stamp()}.json`, serialise(decks));
  return decks.length;
}

export async function exportDeckFile(deck) {
  await shareTextFile(`${safeName(deck.title)}.cram.json`, serialise([deck]));
}

async function readText(uri) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return await res.text();
  }
  const { File } = await import('expo-file-system');
  return await new File(uri).text();
}

// Accepts a backup or a single-deck file. Returns the decks it contains,
// or throws with a message fit for an alert.
export async function readDeckFile(uri) {
  let parsed;
  try {
    parsed = JSON.parse(await readText(uri));
  } catch {
    throw new Error("That file isn't a Cram backup.");
  }
  const decks = Array.isArray(parsed?.decks) ? parsed.decks : parsed?.cards ? [parsed] : null;
  if (!decks) throw new Error("That file isn't a Cram backup.");
  const valid = decks.filter(
    (d) => d && typeof d.id === 'string' && Array.isArray(d.cards) && d.cards.every((c) => c?.front && c?.back),
  );
  if (!valid.length) throw new Error('No decks found in that file.');
  return valid;
}

export async function pickDeckFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return await readDeckFile(result.assets[0].uri);
}

// Merge rule: a deck already on the phone wins if it has been studied more
// recently - the backup is there to fill gaps, not to roll progress back.
export function mergeDecks(existing, incoming) {
  const byId = new Map(existing.map((d) => [d.id, d]));
  for (const d of incoming) {
    const mine = byId.get(d.id);
    if (!mine || lastStudied(d) > lastStudied(mine)) byId.set(d.id, d);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function lastStudied(deck) {
  return Math.max(0, ...deck.cards.map((c) => (c.srs?.due || 0) - (c.srs?.interval || 0) * 86400000));
}
