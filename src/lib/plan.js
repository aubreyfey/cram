import { daysUntil, examDecks } from './exams';

// The half of a study guide that needs no model: given the date and the
// cards, what should today look like. Recomputed every time the hub opens,
// so it is always about now.
//
//   learned   reps >= 2           it has come back and been got twice
//   started   reps == 1 or rated  seen, not solid
//   new       never rated
//   weak      ease < 2.3          failed at least once (Again drops ease by 0.2)

export function studyPlan(exam, decks) {
  const linked = examDecks(exam, decks);
  const cards = linked.flatMap((d) => d.cards.map((c) => ({ ...c, deckTitle: d.title })));
  const now = Date.now();
  const days = Math.max(0, daysUntil(exam.date));

  const learned = cards.filter((c) => c.srs && c.srs.reps >= 2);
  const fresh = cards.filter((c) => !c.srs);
  const started = cards.filter((c) => c.srs && c.srs.reps < 2);
  const due = cards.filter((c) => c.srs && c.srs.due <= now);
  const weak = cards
    .filter((c) => c.srs && c.srs.ease < 2.3)
    .sort((a, b) => a.srs.ease - b.srs.ease)
    .slice(0, 6);

  const remaining = fresh.length + started.length;
  // Spread what's left over the days that are left, leaving the last day
  // for review only. Minimum of 5 so a plan never says "learn 1 card".
  const learningDays = Math.max(1, days - 1);
  const perDay = remaining ? Math.max(5, Math.ceil(remaining / learningDays)) : 0;
  const todayNew = days === 0 ? 0 : Math.min(perDay, remaining);

  // Which mode fits the moment.
  const mode =
    days === 0
      ? { key: 'blitz', label: 'Blitz', why: 'Exam day. Speed through everything once.' }
      : days <= 2
        ? { key: 'write', label: 'Write', why: 'Close enough that recall matters more than recognition.' }
        : fresh.length >= cards.length / 2
          ? { key: 'quiz', label: 'Quiz', why: 'Most of this is new. A first pass by recognition is faster.' }
          : { key: 'cards', label: 'Cards', why: 'Daily review keeps the schedule honest.' };

  const onTrack = !remaining || perDay <= 40;

  return {
    days,
    decks: linked.length,
    total: cards.length,
    learned: learned.length,
    remaining,
    due: due.length,
    todayNew,
    perDay,
    weak,
    mode,
    onTrack,
    progress: cards.length ? learned.length / cards.length : 0,
    // Everything the AI guide is built from, in order.
    cards: cards.map((c) => ({ front: c.front, back: c.back })),
  };
}

export function todayLine(plan) {
  if (!plan.total) return 'Link some decks to this exam to get a plan.';
  if (plan.days === 0 && plan.due === 0 && plan.remaining === 0) return "It's today. You've done the work - one Blitz and go.";
  if (plan.days === 0) return `It's today. Review ${plan.due || plan.total} cards, then stop.`;
  const parts = [];
  if (plan.todayNew) parts.push(`learn ${plan.todayNew} new`);
  if (plan.due) parts.push(`review ${plan.due} due`);
  if (!parts.length) return 'Nothing due today. Ahead of schedule.';
  return `Today: ${parts.join(', ')}.`;
}
