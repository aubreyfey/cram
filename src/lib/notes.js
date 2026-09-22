import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { notifyChange, recordDeleted } from './storage';

// Notes and notebooks: the visual side of studying. A photo of the
// whiteboard, the diagram redrawn by hand, a paragraph explaining it in
// your own words, thirty seconds of you saying it out loud - kept together,
// by day, in a notebook per subject. Cards are what you test yourself on;
// this is where the material lives.
//
//   notebook  { id, title, cover: { file } | null, createdAt, updatedAt, archived }
//   note      { id, notebookId, title, text, place, at, images: [{ file, width, height }],
//               audio: { file, duration } | null, createdAt, updatedAt }
//
// `at` is when the note is *about* (editable), createdAt is when it was
// made. Photos and audio are files under documents/notes, referenced by
// name - iOS moves the container on every update. On the web they are
// blob URLs and last the session.

const NOTEBOOKS_KEY = 'cram.notebooks.v1';
const NOTES_KEY = 'cram.notes.v1';
const DIR = 'notes';
const MAX_IMAGE = 1600;

export const MAX_IMAGES = 24;
export const MAX_TITLE = 80;
export const MAX_TEXT = 8000;

let seq = 0;
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------------------------------------------------------------------------
// Notebooks

export async function loadNotebooks() {
  try {
    const raw = await AsyncStorage.getItem(NOTEBOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function makeNotebook(title) {
  const now = Date.now();
  return { id: newId('nb'), title: (title || '').trim().slice(0, MAX_TITLE) || 'Untitled', cover: null, createdAt: now, updatedAt: now, archived: false };
}

export async function saveNotebook(notebook) {
  const all = await loadNotebooks();
  const next = [{ ...notebook, updatedAt: Date.now() }, ...all.filter((n) => n.id !== notebook.id)].sort(byNewest);
  await AsyncStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(next));
  notifyChange();
  return next;
}

// Deleting a notebook deletes its notes. Returns both lists.
export async function deleteNotebook(id) {
  const [books, notes] = await Promise.all([loadNotebooks(), loadNotes()]);
  const gone = books.find((b) => b.id === id);
  const doomed = notes.filter((n) => n.notebookId === id);
  for (const n of doomed) {
    await recordDeleted(n.id);
    deleteNoteFiles(n);
  }
  if (gone?.cover) deleteFiles([gone.cover.file]);
  await recordDeleted(id);
  const nextBooks = books.filter((b) => b.id !== id);
  const nextNotes = notes.filter((n) => n.notebookId !== id);
  await AsyncStorage.multiSet([
    [NOTEBOOKS_KEY, JSON.stringify(nextBooks)],
    [NOTES_KEY, JSON.stringify(nextNotes)],
  ]);
  notifyChange();
  return { notebooks: nextBooks, notes: nextNotes };
}

// ---------------------------------------------------------------------------
// Notes

export async function loadNotes() {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function makeNote(notebookId, at = Date.now()) {
  const now = Date.now();
  return { id: newId('note'), notebookId, title: '', text: '', place: '', at, images: [], audio: null, createdAt: now, updatedAt: now };
}

export async function saveNote(note) {
  const all = await loadNotes();
  const clean = {
    ...note,
    title: (note.title || '').trim().slice(0, MAX_TITLE),
    text: (note.text || '').trim().slice(0, MAX_TEXT),
    place: (note.place || '').trim().slice(0, MAX_TITLE),
    updatedAt: Date.now(),
  };
  const next = [clean, ...all.filter((n) => n.id !== note.id)].sort(byAt);
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next));
  notifyChange();
  return next;
}

export async function deleteNote(id) {
  const all = await loadNotes();
  const gone = all.find((n) => n.id === id);
  if (gone) deleteNoteFiles(gone);
  await recordDeleted(id);
  const next = all.filter((n) => n.id !== id);
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next));
  notifyChange();
  return next;
}

// A note with nothing in it is not a note. The editor uses this to decide
// whether Cancel should ask, and whether Save should bother.
export function isEmptyNote(note) {
  return !note.title?.trim() && !note.text?.trim() && !note.images?.length && !note.audio;
}

// Whole-list writes from a cloud merge. Quiet: no change notification.
export async function writeMergedNotes({ notebooks, notes }) {
  await AsyncStorage.multiSet([
    [NOTEBOOKS_KEY, JSON.stringify(notebooks)],
    [NOTES_KEY, JSON.stringify(notes)],
  ]);
}

// ---------------------------------------------------------------------------
// Views over the data - pure, tested.

const byNewest = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
const byAt = (a, b) => (b.at || 0) - (a.at || 0);

export function dayOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Newest day first, newest note first within the day. The day's place is
// the first one anyone typed that day - a trip has one, a Tuesday at the
// library has one, a night at home has none.
export function groupByDay(notes) {
  const days = new Map();
  for (const n of [...notes].sort(byAt)) {
    const day = dayOf(n.at);
    if (!days.has(day)) days.set(day, { day, place: '', notes: [] });
    const g = days.get(day);
    g.notes.push(n);
    if (!g.place && n.place) g.place = n.place;
  }
  return [...days.values()];
}

export function countByNotebook(notes) {
  const counts = {};
  for (const n of notes) counts[n.notebookId] = (counts[n.notebookId] || 0) + 1;
  return counts;
}

// Title, text, place, and the notebook's name. "krebs" finds the note in
// "Biology" and every note in a notebook called "Krebs cycle".
export function searchNotes(notes, notebooks, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return notes;
  const bookNames = Object.fromEntries(notebooks.map((b) => [b.id, (b.title || '').toLowerCase()]));
  const hit = (s) => typeof s === 'string' && s.toLowerCase().includes(q);
  return notes.filter((n) => hit(n.title) || hit(n.text) || hit(n.place) || (bookNames[n.notebookId] || '').includes(q));
}

// Cloud merge for notebooks and notes: union by id, the more recently
// edited copy wins, tombstones from either side apply. Same shape as the
// deck merge, but on updatedAt - a note has no schedule to compare.
export function mergeNotes(mine, theirs, deleted = {}) {
  const byId = new Map((theirs || []).map((x) => [x.id, x]));
  for (const x of mine || []) {
    const other = byId.get(x.id);
    if (!other || (x.updatedAt || 0) >= (other.updatedAt || 0)) byId.set(x.id, x);
  }
  return [...byId.values()].filter((x) => !deleted[x.id]);
}

// ---------------------------------------------------------------------------
// Files

// Brings a picked or captured photo into the note: resized so a 12MP frame
// does not sit in the document folder, saved by name. Returns what the
// note stores.
export async function importImage(uri) {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(probe.width, probe.height) > MAX_IMAGE) {
    ctx.resize(probe.width >= probe.height ? { width: MAX_IMAGE } : { height: MAX_IMAGE });
  }
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const stored = await keep(newId('img') + '.jpg', saved.uri);
  return { ...stored, width: saved.width, height: saved.height };
}

export async function importAudio(uri, duration) {
  const ext = (uri.split('.').pop() || 'm4a').split('?')[0].slice(0, 5);
  const stored = await keep(`${newId('aud')}.${ext}`, uri);
  return { ...stored, duration: Math.round(duration || 0) };
}

async function keep(name, uri) {
  if (Platform.OS === 'web') return { uri };
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, DIR);
  dir.create({ intermediates: true, idempotent: true });
  await new File(uri).move(new File(dir, name), { overwrite: true });
  return { file: name };
}

// Where to load a stored image or recording from. Null when it is not on
// this phone (a note restored from the cloud has the name, not the bytes).
export function fileUri(ref) {
  if (!ref) return null;
  if (ref.uri) return ref.uri;
  if (!ref.file || Platform.OS === 'web') return null;
  const { File, Paths } = require('expo-file-system');
  return new File(Paths.document, DIR, ref.file).uri;
}

export function deleteNoteFiles(note) {
  deleteFiles([...(note.images || []).map((i) => i.file), note.audio?.file]);
}

export function deleteFiles(names) {
  if (Platform.OS === 'web') return;
  const files = names.filter(Boolean);
  if (!files.length) return;
  import('expo-file-system')
    .then(({ File, Paths }) => {
      for (const name of files) {
        const f = new File(Paths.document, DIR, name);
        if (f.exists) f.delete();
      }
    })
    .catch(() => {});
}
