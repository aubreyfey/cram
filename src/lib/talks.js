import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyChange, recordDeleted } from './storage';

// Talks: the student explaining what they learned, out loud, to their
// phone. Kept as their own little podcast - play it back on the bus - and
// the transcript is the raw material for cards. Stored on the device, like
// everything else.
//
//   { id, title, uri, duration, transcript, deckId?, examId?, createdAt }
const KEY = 'cram.talks.v1';

export async function loadTalks() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTalk(talk) {
  const talks = await loadTalks();
  const next = [talk, ...talks.filter((t) => t.id !== talk.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  notifyChange();
  return next;
}

export async function deleteTalk(id) {
  const talks = await loadTalks();
  const gone = talks.find((t) => t.id === id);
  await recordDeleted(id);
  const next = talks.filter((t) => t.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  notifyChange();
  if (gone?.uri && Platform.OS !== 'web') {
    try {
      const { File } = await import('expo-file-system');
      const f = new File(gone.uri);
      if (f.exists) f.delete();
    } catch {
      // Already gone.
    }
  }
  return next;
}

// Recordings land in a cache directory the OS may clear. Move them home.
// On web the uri is a blob: URL that lives as long as the tab; nothing to do.
export async function keepRecording(id, uri) {
  if (Platform.OS === 'web' || !uri) return uri;
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'talks');
    dir.create({ intermediates: true, idempotent: true });
    const ext = (uri.split('.').pop() || 'm4a').split('?')[0].slice(0, 5);
    const dest = new File(dir, `${id}.${ext}`);
    await new File(uri).move(dest, { overwrite: true });
    return dest.uri;
  } catch {
    return uri;
  }
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Whole-list write from a cloud merge. Quiet: no change notification.
export async function writeMergedTalks(talks) {
  await AsyncStorage.setItem(KEY, JSON.stringify(talks));
}
