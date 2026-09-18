import { Platform } from 'react-native';

// Keeping the PDF a deck came from. The picker hands us a file in the cache,
// which the OS may clear; a copy in the app's documents directory survives
// until the deck is deleted. Web has no persistent files - the blob: URL
// dies with the tab - so there the deck simply has no source afterwards.
export async function keepSource(deckId, source) {
  if (Platform.OS === 'web' || source?.kind !== 'pdf') return null;
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'sources');
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${deckId}.pdf`);
    await new File(source.uri).copy(dest, { overwrite: true });
    return { kind: 'pdf', uri: dest.uri, name: source.name || null };
  } catch {
    // Not worth failing the deck over - the cards are what matters.
    return null;
  }
}

export async function dropSource(deck) {
  if (Platform.OS === 'web' || !deck?.source?.uri) return;
  try {
    const { File } = await import('expo-file-system');
    const f = new File(deck.source.uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone. Fine.
  }
}
