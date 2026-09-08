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

export async function getUsage() {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    const usage = raw ? JSON.parse(raw) : null;
    if (!usage || usage.date !== today()) return { date: today(), cards: 0 };
    return usage;
  } catch {
    return { date: today(), cards: 0 };
  }
}

export async function addUsage(cards) {
  const usage = await getUsage();
  const next = { date: today(), cards: usage.cards + cards };
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
  return next;
}
