import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './stubs/async-storage.mjs';
import {
  countByNotebook,
  dayOf,
  deleteNote,
  deleteNotebook,
  groupByDay,
  isEmptyNote,
  loadNotebooks,
  loadNotes,
  makeNote,
  makeNotebook,
  mergeNotes,
  saveNote,
  saveNotebook,
  searchNotes,
} from '../src/lib/notes.js';
import { loadDeleted } from '../src/lib/storage.js';

beforeEach(reset);

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

test('notebooks: create, rename, delete with its notes and tombstones', async () => {
  const bio = makeNotebook('  Biology ');
  assert.equal(bio.title, 'Biology');
  await saveNotebook(bio);
  await saveNotebook(makeNotebook('Japan'));
  await saveNote({ ...makeNote(bio.id), text: 'mitochondria' });
  await saveNote({ ...makeNote(bio.id), text: 'ribosome' });
  assert.equal((await loadNotes()).length, 2);

  await saveNotebook({ ...bio, title: 'Bio 101' });
  assert.equal((await loadNotebooks()).find((b) => b.id === bio.id).title, 'Bio 101');
  assert.equal((await loadNotebooks()).length, 2, 'rename is not a duplicate');

  const { notebooks, notes } = await deleteNotebook(bio.id);
  assert.equal(notebooks.length, 1);
  assert.equal(notes.length, 0);
  const dead = await loadDeleted();
  assert.ok(dead[bio.id]);
  assert.equal(Object.keys(dead).length, 3, 'the notebook and both notes');
});

test('notes: save trims and caps, sorts by at, delete tombstones', async () => {
  const nb = makeNotebook('X');
  const older = { ...makeNote(nb.id, at(2026, 9, 18, 5, 17)), title: '  Morning  ', text: 'x'.repeat(9000) };
  const newer = { ...makeNote(nb.id, at(2026, 9, 18, 17, 46)), title: 'Evening' };
  await saveNote(older);
  await saveNote(newer);
  const notes = await loadNotes();
  assert.deepEqual(
    notes.map((n) => n.title),
    ['Evening', 'Morning'],
  );
  assert.equal(notes[1].text.length, 8000);
  await deleteNote(older.id);
  assert.equal((await loadNotes()).length, 1);
  assert.ok((await loadDeleted())[older.id]);
});

test('isEmptyNote: nothing typed, nothing attached', () => {
  const n = makeNote('nb');
  assert.ok(isEmptyNote(n));
  assert.ok(!isEmptyNote({ ...n, text: 'hi' }));
  assert.ok(!isEmptyNote({ ...n, images: [{ file: 'a.jpg' }] }));
  assert.ok(!isEmptyNote({ ...n, audio: { file: 'a.m4a', duration: 3 } }));
});

test('groupByDay: newest day first, newest note first, place is the first typed that day', () => {
  const notes = [
    { id: 'a', at: at(2026, 9, 18, 5, 17), place: '' },
    { id: 'b', at: at(2026, 9, 18, 17, 46), place: 'Grand Yoho' },
    { id: 'c', at: at(2026, 9, 18, 18, 14), place: 'Elsewhere' },
    { id: 'd', at: at(2026, 9, 20, 9, 0), place: '' },
  ];
  const days = groupByDay(notes);
  assert.deepEqual(
    days.map((g) => g.day),
    ['2026-09-20', '2026-09-18'],
  );
  assert.deepEqual(
    days[1].notes.map((n) => n.id),
    ['c', 'b', 'a'],
  );
  assert.equal(days[1].place, 'Elsewhere', 'first in display order');
  assert.equal(days[0].place, '');
  assert.equal(dayOf(at(2026, 1, 5)), '2026-01-05', 'local calendar day, zero-padded');
});

test('countByNotebook and searchNotes (title, text, place, notebook name)', () => {
  const books = [
    { id: 'bio', title: 'Biology' },
    { id: 'jp', title: 'Japan Trip' },
  ];
  const notes = [
    { id: '1', notebookId: 'bio', title: 'Krebs cycle', text: '', place: '' },
    { id: '2', notebookId: 'bio', title: '', text: 'the ribosome reads mRNA', place: '' },
    { id: '3', notebookId: 'jp', title: '', text: 'ramen', place: 'Shinjuku' },
  ];
  assert.deepEqual(countByNotebook(notes), { bio: 2, jp: 1 });
  assert.deepEqual(searchNotes(notes, books, 'krebs').map((n) => n.id), ['1']);
  assert.deepEqual(searchNotes(notes, books, 'mRNA').map((n) => n.id), ['2']);
  assert.deepEqual(searchNotes(notes, books, 'shinj').map((n) => n.id), ['3']);
  assert.deepEqual(searchNotes(notes, books, 'biolog').map((n) => n.id), ['1', '2']);
  assert.equal(searchNotes(notes, books, '  ').length, 3);
});

test('mergeNotes: union by id, newer edit wins, tombstones apply', () => {
  const mine = [
    { id: 'a', updatedAt: 10, text: 'mine' },
    { id: 'b', updatedAt: 5, text: 'mine old' },
    { id: 'gone', updatedAt: 1 },
  ];
  const theirs = [
    { id: 'a', updatedAt: 9, text: 'theirs' },
    { id: 'b', updatedAt: 7, text: 'theirs newer' },
    { id: 'c', updatedAt: 1, text: 'only theirs' },
  ];
  const m = mergeNotes(mine, theirs, { gone: 1 });
  const by = Object.fromEntries(m.map((x) => [x.id, x.text]));
  assert.deepEqual(by, { a: 'mine', b: 'theirs newer', c: 'only theirs' });
  assert.deepEqual(mergeNotes(undefined, undefined), []);
});
