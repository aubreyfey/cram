import AsyncStorage from '@react-native-async-storage/async-storage';

const DECKS_KEY = 'cram.decks.v1';
const USAGE_KEY = 'cram.usage.v1';

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
