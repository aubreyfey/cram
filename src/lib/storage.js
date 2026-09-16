import AsyncStorage from '@react-native-async-storage/async-storage';

const DECKS_KEY = 'cram.decks.v1';
const USAGE_KEY = 'cram.usage.v1';
const STREAK_KEY = 'cram.streak.v1';

export async function loadDecks() {
  try {
    const raw = await AsyncStorage.getItem(DECKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveDeck(deck) {
  const decks = await loadDecks();
  const next = [deck, ...decks.filter((d) => d.id !== deck.id)];
  await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(next));
  return next;
}

export async function deleteDeck(id) {
  const decks = await loadDecks();
  const next = decks.filter((d) => d.id !== id);
  await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(next));
  return next;
}

// Writes card changes back to whichever deck each card belongs to. Used by the
// cross-deck "due today" session, where one study queue spans many decks and a
// rating on card 3 might belong to a different deck than card 4.
//   updates: cards carrying a `deckId`, replaced in place
//   removed: card ids to drop from any deck they appear in
export async function saveCards(updates, removed = []) {
  const decks = await loadDecks();
  const byId = new Map(updates.map((c) => [c.id, c]));
  const gone = new Set(removed);
  const next = decks.map((d) => ({
    ...d,
    cards: d.cards
      .filter((c) => !gone.has(c.id))
      .map((c) => {
        const u = byId.get(c.id);
        if (!u || u.deckId !== d.id) return c;
        const { deckId, ...card } = u;
        return card;
      }),
  }));
  await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(next));
  return next;
}

// Free tier is metered per day, reset on the local calendar date. Cheap to
// implement and it resets right when a student needs it most - the night
// before an exam - which is exactly where the upgrade prompt should land.
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Two counters, because they answer different questions. Cards meter the free
// tier (what the user perceives they're getting). Scans meter cost - we pay per
// request, whether it comes back with 6 cards or 90.
export async function getUsage() {
  const empty = { date: today(), cards: 0, scans: 0 };
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    const usage = raw ? JSON.parse(raw) : null;
    if (!usage || usage.date !== today()) return empty;
    return { ...empty, ...usage };
  } catch {
    return empty;
  }
}

export async function addUsage(cards) {
  const usage = await getUsage();
  const next = {
    date: today(),
    cards: usage.cards + cards,
    scans: usage.scans + 1,
  };
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
  return next;
}

// Study streak: consecutive calendar days with at least one card rated. It is
// the one retention mechanic that costs nothing to build and that students
// already understand from every other app on their phone.
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getStreak() {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (!s) return { count: 0, last: null };
    // A streak that was not continued yesterday or today is over. Reporting
    // the stale number would show "7-day streak" a month later.
    if (s.last !== today() && s.last !== yesterday()) return { count: 0, last: s.last };
    return s;
  } catch {
    return { count: 0, last: null };
  }
}

export async function touchStreak() {
  const s = await getStreak();
  if (s.last === today()) return s;
  const next = { count: s.last === yesterday() ? s.count + 1 : 1, last: today() };
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next));
  return next;
}

// Admin code. Stored only after the server has confirmed it, and sent back on
// every scan so the server can recognise us. It is the operator's own
// device, so a plain AsyncStorage key is enough - the secret it unlocks is
// still checked server-side on every request.
const ADMIN_KEY = 'cram.admin.v1';

export async function getAdminCode() {
  try {
    return (await AsyncStorage.getItem(ADMIN_KEY)) || null;
  } catch {
    return null;
  }
}

export async function setAdminCode(code) {
  if (code) await AsyncStorage.setItem(ADMIN_KEY, code);
  else await AsyncStorage.removeItem(ADMIN_KEY);
}
