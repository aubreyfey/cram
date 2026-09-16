// A trimmed SM-2. Full SuperMemo has knobs no student will ever touch, so
// we expose three buttons and keep the interval math behind them.

const DAY = 24 * 60 * 60 * 1000;

export const RATING = { AGAIN: 'again', HARD: 'hard', GOOD: 'good' };

export function initialSchedule() {
  return { ease: 2.5, interval: 0, reps: 0, due: Date.now() };
}

export function schedule(card, rating) {
  const s = card.srs || initialSchedule();
  let { ease, interval, reps } = s;

  if (rating === RATING.AGAIN) {
    // Reset the streak but keep some ease so one bad night doesn't bury a card.
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === RATING.HARD) {
    reps += 1;
    ease = Math.max(1.3, ease - 0.15);
    interval = interval === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
  } else {
    reps += 1;
    ease = Math.min(3.0, ease + 0.1);
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
  }

  return {
    ...card,
    srs: { ease, interval, reps, due: Date.now() + interval * DAY },
  };
}

export function dueCards(cards) {
  const now = Date.now();
  const due = cards.filter((c) => !c.srs || c.srs.due <= now);
  return due.length ? due : cards;
}

export function deckProgress(cards) {
  if (!cards.length) return 0;
  const learned = cards.filter((c) => c.srs && c.srs.reps >= 2).length;
  return learned / cards.length;
}

// Cards that would be served by dueCards without the "nothing due, show all"
// fallback - what the library shows as "N due". Unstudied cards count as due
// because they are exactly what the student should look at next.
export function dueCount(cards) {
  const now = Date.now();
  return cards.filter((c) => !c.srs || c.srs.due <= now).length;
}
