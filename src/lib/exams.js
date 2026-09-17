import { dueCount, deckProgress } from './srs';

// Date maths for exams. Dates are local calendar days as 'YYYY-MM-DD' -
// an exam is on a day, not at an instant, and comparing instants across
// midnight is how you get "in 0 days" at 11pm.
export function today() {
  const d = new Date();
  return toKey(d);
}

export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function daysUntil(key) {
  const ms = fromKey(key).getTime() - fromKey(today()).getTime();
  return Math.round(ms / 86400000);
}

// "today", "tomorrow", "in 3 days", "in 2 weeks", "was 2 days ago"
export function countdown(key) {
  const n = daysUntil(key);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 0) return n === -1 ? 'yesterday' : `${-n} days ago`;
  if (n < 14) return `in ${n} days`;
  const w = Math.round(n / 7);
  return `in ${w} ${w === 1 ? 'week' : 'weeks'}`;
}

export function prettyDate(key) {
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Exams that still matter: today and later, plus yesterday's so a finished
// exam lingers one day (people like to see it crossed off) then goes.
export function upcoming(exams) {
  return exams.filter((e) => daysUntil(e.date) >= -1);
}

export function examDecks(exam, decks) {
  const ids = new Set(exam.deckIds || []);
  return decks.filter((d) => ids.has(d.id));
}

export function examStats(exam, decks) {
  const linked = examDecks(exam, decks);
  const cards = linked.flatMap((d) => d.cards);
  return {
    decks: linked.length,
    cards: cards.length,
    due: linked.reduce((n, d) => n + dueCount(d.cards), 0),
    progress: cards.length ? deckProgress(cards) : 0,
  };
}
