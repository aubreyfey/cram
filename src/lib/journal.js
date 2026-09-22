import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyChange } from './storage';

// The study journal: what each day held. The streak says how many days in
// a row; this says what was in them - three scans, forty cards, most of
// them right, four minutes of explaining out loud. One entry per calendar
// day, numbers only, added to as the day goes. Kept for a year.
//
//   { [YYYY-MM-DD]: { scans, cards, rated, again, hard, good, talks, talkSeconds } }

const KEY = 'cram.journal.v1';
const KEEP_DAYS = 366;
export const FIELDS = ['scans', 'cards', 'rated', 'again', 'hard', 'good', 'talks', 'talkSeconds'];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadJournal() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Adds to today. logJournal({ scans: 1, cards: 12 }) after a scan;
// { rated: 1, good: 1 } after a rating; { talks: 1, talkSeconds: 240 }.
export async function logJournal(patch, day = today()) {
  const j = await loadJournal();
  const entry = { ...(j[day] || {}) };
  for (const k of FIELDS) if (patch[k]) entry[k] = (entry[k] || 0) + patch[k];
  j[day] = entry;
  await AsyncStorage.setItem(KEY, JSON.stringify(trimJournal(j)));
  notifyChange();
  return j;
}

export function trimJournal(j) {
  const days = Object.keys(j).sort();
  if (days.length <= KEEP_DAYS) return j;
  return Object.fromEntries(days.slice(-KEEP_DAYS).map((d) => [d, j[d]]));
}

// Two phones, one day: neither has the whole picture, and adding would
// double-count a synced rating. The larger number per field is the honest
// floor.
export function mergeJournal(a = {}, b = {}) {
  const out = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[day] || {};
    const y = b[day] || {};
    const e = {};
    for (const k of FIELDS) {
      const v = Math.max(x[k] || 0, y[k] || 0);
      if (v) e[k] = v;
    }
    out[day] = e;
  }
  return trimJournal(out);
}

// From a cloud merge. Quiet: no change notification.
export async function writeMergedJournal(j) {
  await AsyncStorage.setItem(KEY, JSON.stringify(j));
}

// Days with anything in them, newest first: [{ day, ...entry }]
export function journalDays(j) {
  return Object.entries(j)
    .filter(([, e]) => FIELDS.some((k) => e[k]))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, e]) => ({ day, ...e }));
}

// Totals over the last n days, today included.
export function summarize(j, n = 7, ref = today()) {
  const end = new Date(ref + 'T00:00:00Z').getTime();
  const start = end - (n - 1) * 86400000;
  const sum = Object.fromEntries(FIELDS.map((k) => [k, 0]));
  let activeDays = 0;
  for (const [day, e] of Object.entries(j)) {
    const t = new Date(day + 'T00:00:00Z').getTime();
    if (t < start || t > end) continue;
    if (FIELDS.some((k) => e[k])) activeDays++;
    for (const k of FIELDS) sum[k] += e[k] || 0;
  }
  // "Got it" only: Hard is a save, not a win.
  return { ...sum, activeDays, accuracy: sum.rated ? sum.good / sum.rated : null };
}
