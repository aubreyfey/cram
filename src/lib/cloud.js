import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountIsLive, getSession, onAuthChange } from './account';
import { friendly, supabase } from './supabase';
import { mergeDecks } from './backup';
import {
  loadDecks,
  loadDeleted,
  loadExams,
  loadStreakRaw,
  onChange,
  trimDeleted,
  writeMerged,
} from './storage';
import { loadTalks, writeMergedTalks } from './talks';
import { getProfile, writeMergedName } from './profile';
import { loadJournal, mergeJournal, writeMergedJournal } from './journal';
import { loadNotebooks, loadNotes, mergeNotes, writeMergedNotes } from './notes';

// Cloud backup. Signed in, everything that matters lives in one row per
// person (supabase/schema.sql → backups): decks with their schedule, exams,
// talks, streak, name. It is a backup that syncs, not a live shared
// document - phone first, cloud second, and nothing here is on the path
// between shutter and cards.
//
// When it runs: at launch, when the app comes to the foreground, right
// after signing in, and a few seconds after any local change. Every run is
// pull → merge → write local → push, so two phones converge without
// either one clobbering the other.
//
// Merge rules, all "fill gaps, never roll back":
//   decks   the copy studied more recently wins (mergeDecks, same as a
//           file import)
//   exams   union by id; this phone's copy wins a tie
//   talks   union by id; audio stays on the phone that recorded it, the
//           transcript travels (that is the part cards are made from)
//   streak  the later date wins
//   name    this phone's, unless it has none
//   journal per day, the larger number per field - a synced rating must
//           not count twice
//   notes   notebooks and notes: union by id, the more recently edited copy
//           wins; photos and recordings stay on the phone that made them
//   deleted union - a deck deleted anywhere stays deleted everywhere
//
//   sync()          -> { changed } - did the merge alter local data
//   getStatus()     -> { signedIn, syncing, lastSync, error }
//   onStatus(fn)    -> unsubscribe
//   onMerged(fn)    -> called when a pull changed local data (reload state)

const FORMAT = 2;
const META_KEY = 'cram.cloud.v1';
const PUSH_DELAY = 3000;

let status = { signedIn: false, syncing: false, lastSync: null, error: null };
const statusListeners = new Set();
const mergedListeners = new Set();
let inFlight = null;
let again = false;
let pushTimer = null;
let started = false;

export const cloudIsLive = accountIsLive;

export function getStatus() {
  return status;
}

export function onStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

export function onMerged(fn) {
  mergedListeners.add(fn);
  return () => mergedListeners.delete(fn);
}

function setStatus(patch) {
  status = { ...status, ...patch };
  for (const fn of statusListeners) fn(status);
}

// Call once at launch. Listens for sign-in/out and local changes; nothing
// happens on the network until there is a session.
export async function startCloud() {
  if (started || !cloudIsLive) return;
  started = true;
  try {
    const meta = JSON.parse((await AsyncStorage.getItem(META_KEY)) || 'null');
    if (meta?.lastSync) setStatus({ lastSync: meta.lastSync });
  } catch {
    // No meta yet.
  }
  setStatus({ signedIn: !!(await getSession()) });
  onAuthChange((session) => {
    const signedIn = !!session;
    if (signedIn === status.signedIn) return;
    setStatus({ signedIn, error: null });
    if (signedIn) sync();
    else {
      clearTimeout(pushTimer);
      AsyncStorage.removeItem(META_KEY).catch(() => {});
      setStatus({ lastSync: null });
    }
  });
  onChange(() => {
    if (!status.signedIn) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => sync(), PUSH_DELAY);
  });
  if (status.signedIn) sync();
}

export function sync() {
  if (!cloudIsLive) return Promise.resolve({ changed: false });
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = run()
    .catch((e) => {
      setStatus({ error: friendly(e) });
      return { changed: false };
    })
    .finally(() => {
      inFlight = null;
      setStatus({ syncing: false });
      if (again) {
        again = false;
        sync();
      }
    });
  return inFlight;
}

async function run() {
  const session = await getSession();
  if (!session) {
    setStatus({ signedIn: false });
    return { changed: false };
  }
  clearTimeout(pushTimer);
  setStatus({ signedIn: true, syncing: true, error: null });

  // Remote first, then local: the merge is written back over local, so the
  // gap between reading it and writing it should not include a network
  // round-trip that a card rating could land inside.
  const { data, error } = await supabase()
    .from('backups')
    .select('data, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  const local = await snapshot();

  let merged = local;
  let changed = false;
  if (data?.data && data.data.cram === FORMAT) {
    merged = merge(local, data.data);
    changed = differs(local, merged);
    if (changed) {
      await writeMerged({ decks: merged.decks, exams: merged.exams, streak: merged.streak, deleted: merged.deleted });
      await writeMergedTalks(merged.talks);
      await writeMergedJournal(merged.journal);
      await writeMergedNotes({ notebooks: merged.notebooks, notes: merged.notes });
      if (merged.profile.name !== local.profile.name) await writeMergedName(merged.profile.name);
    }
  }

  // The uploaded copy never carries audio paths; they mean nothing off this
  // phone and would only mislead the merge on the next one.
  const upload = {
    ...merged,
    savedAt: Date.now(),
    talks: merged.talks.map(({ uri, ...t }) => t),
    // Same for notes: file names travel, blob URLs (web) do not.
    notes: merged.notes.map((n) => ({ ...n, images: (n.images || []).map(({ uri, ...i }) => i), audio: n.audio ? (({ uri, ...a }) => a)(n.audio) : null })),
  };
  const { error: upErr } = await supabase()
    .from('backups')
    .upsert({ user_id: session.user.id, data: upload, updated_at: new Date().toISOString() });
  if (upErr) throw upErr;

  const lastSync = Date.now();
  await AsyncStorage.setItem(META_KEY, JSON.stringify({ lastSync }));
  setStatus({ lastSync });
  if (changed) for (const fn of mergedListeners) fn();
  return { changed };
}

async function snapshot() {
  const [decks, exams, talks, streak, deleted, profile, journal, notebooks, notes] = await Promise.all([
    loadDecks(),
    loadExams(),
    loadTalks(),
    loadStreakRaw(),
    loadDeleted(),
    getProfile(),
    loadJournal(),
    loadNotebooks(),
    loadNotes(),
  ]);
  return { cram: FORMAT, decks, exams, talks, streak, deleted, profile: { name: profile.name || '' }, journal, notebooks, notes };
}

// Exported for the tests; nothing else calls it directly.
export function merge(local, remote) {
  const deleted = trimDeleted({ ...(remote.deleted || {}), ...local.deleted });
  const alive = (x) => !deleted[x.id];

  const decks = mergeDecks(local.decks, (remote.decks || []).filter(alive)).filter(alive);

  const exams = unionById(local.exams, remote.exams)
    .filter(alive)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const talks = unionById(local.talks, remote.talks)
    .filter(alive)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const r = remote.streak || { count: 0, last: null };
  const l = local.streak;
  const streak = !l.last || (r.last && r.last > l.last) ? r : l.last === r.last ? { ...l, count: Math.max(l.count, r.count || 0) } : l;

  const name = local.profile.name || remote.profile?.name || '';
  const journal = mergeJournal(local.journal, remote.journal);
  const notebooks = mergeNotes(local.notebooks, remote.notebooks, deleted);
  const notes = mergeNotes(local.notes, remote.notes, deleted);

  return { cram: FORMAT, decks, exams, talks, streak, deleted, profile: { name }, journal, notebooks, notes };
}

// This phone's copy wins; the other phone only fills in what is missing.
function unionById(mine, theirs) {
  const byId = new Map((theirs || []).map((x) => [x.id, x]));
  for (const x of mine) byId.set(x.id, x);
  return [...byId.values()];
}

function differs(a, b) {
  return (
    JSON.stringify(a.decks) !== JSON.stringify(b.decks) ||
    JSON.stringify(a.exams) !== JSON.stringify(b.exams) ||
    JSON.stringify(a.talks) !== JSON.stringify(b.talks) ||
    JSON.stringify(a.streak) !== JSON.stringify(b.streak) ||
    a.profile.name !== b.profile.name ||
    JSON.stringify(a.journal || {}) !== JSON.stringify(b.journal || {}) ||
    JSON.stringify(a.notebooks || []) !== JSON.stringify(b.notebooks || []) ||
    JSON.stringify(a.notes || []) !== JSON.stringify(b.notes || []) ||
    Object.keys(a.deleted).length !== Object.keys(b.deleted).length
  );
}

// The Library's one-time "back this up?" nudge for people who have never
// signed in. Shown once there are a few decks worth losing; "Not now"
// puts it away for good. Signing in makes it moot.
const NUDGE_KEY = 'cram.nudge.backup.v1';
export const NUDGE_AFTER_DECKS = 3;

export async function shouldNudgeBackup(deckCount) {
  if (!cloudIsLive || status.signedIn || deckCount < NUDGE_AFTER_DECKS) return false;
  try {
    return !(await AsyncStorage.getItem(NUDGE_KEY));
  } catch {
    return false;
  }
}

export async function dismissBackupNudge() {
  await AsyncStorage.setItem(NUDGE_KEY, String(Date.now()));
}
