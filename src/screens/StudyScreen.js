import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import CardEditor from '../components/CardEditor';
import ExplainSheet from '../components/ExplainSheet';
import Confetti from '../components/Confetti';
import Mascot from '../components/Mascot';
import Flashcard from '../components/Flashcard';
import PrimaryButton from '../components/PrimaryButton';
import QuizStage from '../components/QuizStage';
import ListenStage from '../components/ListenStage';
import WriteStage from '../components/WriteStage';
import { RATING, dueCards, schedule } from '../lib/srs';
import { shareDeck } from '../lib/share';
import { explainCard } from '../lib/api';
import { canExplain } from '../lib/entitlements';
import { addExplain } from '../lib/storage';
import { maybeAskForReview, shareCram } from '../lib/growth';
import { firstName } from '../lib/profile';
import { colors, motion, radius, space, type } from '../theme';

// Five ways through the same queue, in rough order of difficulty. Quiz is
// recognition (first pass), Cards and Write are recall, Blitz is Cards
// against a clock for the night before, Listen is the deck read aloud for
// the walk to class. All of them feed the same schedule.
const MODES = [
  { key: 'cards', label: 'Cards' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'write', label: 'Write' },
  { key: 'blitz', label: 'Blitz' },
  { key: 'listen', label: 'Listen' },
];
const BLITZ_SECONDS = 60;

export default function StudyScreen({
  deck,
  onClose,
  onUpdateDeck,
  onAddPages,
  onFeedback,
  onPaywall,
  onRename,
  onTalk,
  name = '',
  initialMode = 'cards',
}) {
  // The queue is a list of ids fixed at the start of the session; the cards
  // themselves are looked up live so an edit shows on the card in front of
  // you and a deleted card simply drops out of the run.
  const queueIds = useMemo(() => dueCards(deck.cards).map((c) => c.id), [deck.id]);
  const queue = useMemo(() => {
    const byId = new Map(deck.cards.map((c) => [c.id, c]));
    return queueIds.map((id) => byId.get(id)).filter(Boolean);
  }, [queueIds, deck.cards]);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [editing, setEditing] = useState(false);
  // "Why?" state: which card, loading, the text or an error. The text is
  // also written onto the card so the next time is instant and free.
  const [explain, setExplain] = useState(null);
  const [mode, setMode] = useState(initialMode);
  const [timeLeft, setTimeLeft] = useState(BLITZ_SECONDS);
  const [timedOut, setTimedOut] = useState(false);
  const topCardRef = useRef(null);

  // Volt sits by the title and reacts to each rating, then settles. Short,
  // so a fast run through a deck doesn't turn into a puppet show.
  const [reaction, setReaction] = useState('idle');
  const reactionTimer = useRef(null);
  useEffect(() => () => clearTimeout(reactionTimer.current), []);
  const react = (rating) => {
    clearTimeout(reactionTimer.current);
    setReaction(rating === RATING.AGAIN ? 'oops' : 'happy');
    reactionTimer.current = setTimeout(() => setReaction('idle'), 900);
  };

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const insets = useSafeAreaInsets();
  const done = index >= queue.length || timedOut;

  // A finished deck is the signature moment. The review prompt decides for
  // itself whether this is the time (see growth.js); most times it isn't.
  const asked = useRef(false);
  useEffect(() => {
    if (!done || asked.current || timedOut) return;
    asked.current = true;
    maybeAskForReview({ cleanSweep: !ratings[RATING.AGAIN] });
  }, [done]);

  // Blitz: a clock, and only two answers. Switching modes resets it so a
  // half-finished sprint doesn't leak into a calm Cards session.
  useEffect(() => {
    setTimeLeft(BLITZ_SECONDS);
    setTimedOut(false);
    if (mode !== 'blitz' || done) return;
    const t = setInterval(() => {
      setTimeLeft((n) => {
        if (n <= 1) {
          clearInterval(t);
          setTimedOut(true);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  // The buttons ask the top card to fly out; the card reports back through
  // onRate once it has left. That way tapping and swiping look identical
  // instead of the buttons hard-cutting to the next card.
  const requestRate = (rating) => {
    if (topCardRef.current) topCardRef.current.flyOut(rating);
    else rate(rating);
  };

  const rate = (rating) => {
    const card = queue[index];
    if (!card) return;

    const updated = schedule(card, rating);
    onUpdateDeck(
      { ...deck, cards: deck.cards.map((c) => (c.id === updated.id ? updated : c)) },
      { rated: true },
    );

    setRatings((r) => ({ ...r, [rating]: (r[rating] || 0) + 1 }));
    react(rating);
    advance();
  };

  // Listen moves on by itself when nobody taps: the card is heard, not
  // graded, and its schedule is left alone.
  const advance = () => {
    const next = index + 1;
    progress.value = withSpring(next / queue.length, motion.soft);
    setIndex(next);
  };

  const askWhy = async (card) => {
    if (card.explanation) {
      setExplain({ card, explanation: card.explanation });
      return;
    }
    if (!(await canExplain())) {
      onPaywall?.('explain');
      return;
    }
    setExplain({ card, loading: true });
    try {
      const explanation = await explainCard(card, { subject: deck.subject });
      await addExplain();
      setExplain({ card, explanation });
      saveCard({ ...card, explanation });
    } catch (e) {
      setExplain({ card, error: e.message });
    }
  };

  const saveCard = (card) => {
    onUpdateDeck({
      ...deck,
      cards: deck.cards.map((c) => (c.id === card.id ? card : c)),
    });
  };

  const deleteCard = (card) => {
    onUpdateDeck({ ...deck, cards: deck.cards.filter((c) => c.id !== card.id) });
  };

  if (done) {
    const got = (ratings[RATING.GOOD] || 0) + (ratings[RATING.HARD] || 0);
    const cleanSweep = !ratings[RATING.AGAIN];
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        {/* Confetti only for a clean sweep. If it fires every time it stops
            meaning anything, and the redo-tomorrow message deserves calm. */}
        {cleanSweep ? <Confetti /> : null}

        <Animated.View entering={FadeIn.duration(400)} style={styles.summary}>
          <Animated.View entering={ZoomIn.springify().damping(14).delay(120)}>
            <Mascot mood="happy" size={96} />
          </Animated.View>

          <Text style={[styles.summaryScore, { marginTop: space(6) }]}>
            <CountUp to={got} />
            <Text style={styles.summaryTotal}>/{queue.length}</Text>
          </Text>
          <Text style={styles.summaryLabel}>
            {mode === 'blitz' ? `cards you knew in ${BLITZ_SECONDS} seconds` : 'cards you knew'}
          </Text>
          <Text style={styles.summaryBody}>
            {timedOut
              ? `Time. ${queue.length - index} left in the deck.`
              : cleanSweep
                ? firstName(name)
                  ? `Clean sweep, ${firstName(name)}. Nothing to redo.`
                  : 'Clean sweep. Nothing to redo.'
                : `${ratings[RATING.AGAIN]} coming back tomorrow.`}
          </Text>
          <PrimaryButton label="Done" onPress={onClose} style={{ marginTop: space(10) }} />
          {/* The Feynman step: you've just seen every card - now say it
              without looking. The best time to ask is exactly now. */}
          {onTalk ? (
            <PrimaryButton
              label="Explain it out loud"
              variant="ghost"
              onPress={() => onTalk(deck)}
              style={{ marginTop: space(3), alignSelf: 'stretch' }}
            />
          ) : null}
          {/* The end of a run is when someone has the next slide in their
              hand, so "add another page" lives here rather than in a menu.
              A cross-deck session has no single deck to add to, so it only
              gets share. */}
          <View style={styles.afterRow}>
            {onAddPages && !deck.virtual ? (
              <Pressable onPress={() => onAddPages(deck)} hitSlop={8}>
                <Text style={styles.afterLink}>Add another page</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => shareDeck(deck)} hitSlop={8}>
              <Text style={styles.afterLink}>Share deck</Text>
            </Pressable>
            {cleanSweep ? (
              <Pressable onPress={shareCram} hitSlop={8}>
                <Text style={styles.afterLink}>Share Cram</Text>
              </Pressable>
            ) : null}
          </View>
          {onFeedback ? (
            <Pressable onPress={onFeedback} hitSlop={8} style={{ marginTop: space(5) }}>
              <Text style={styles.feedbackLink}>What's missing?</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    );
  }

  // Render three cards deep. Any more is invisible behind the stack and just
  // costs frames on older phones.
  const visible = queue.slice(index, index + 3);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
        <Text style={styles.counter}>
          {index + 1} / {queue.length}
        </Text>
        <Pressable onPress={() => setEditing(true)} hitSlop={16}>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        {/* A cross-deck session has no single deck to rename. */}
        <Pressable
          onPress={() => onRename?.(deck)}
          disabled={deck.virtual || !onRename}
          hitSlop={8}
          style={{ flex: 1 }}
        >
          <Text style={styles.deckTitle} numberOfLines={1}>
            {deck.title}
          </Text>
          {deck.subject ? <Text style={styles.deckSubject}>{deck.subject}</Text> : null}
        </Pressable>
        <Mascot mood={reaction} size={40} />
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, progressStyle]} />
      </View>

      <View style={styles.modes}>
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <ModeChip key={m.key} label={m.label} active={active} onPress={() => setMode(m.key)} />
          );
        })}
        {mode === 'blitz' ? (
          <Text style={[styles.clock, timeLeft <= 10 && { color: colors.again }]}>{timeLeft}s</Text>
        ) : null}
      </View>

      {mode === 'quiz' ? (
        <View style={styles.stageFlat}>
          <QuizStage card={queue[index]} pool={deck.cards} onRate={rate} />
        </View>
      ) : mode === 'write' ? (
        <View style={styles.stageFlat}>
          <WriteStage card={queue[index]} onRate={rate} />
        </View>
      ) : mode === 'listen' ? (
        <View style={styles.stageFlat}>
          <ListenStage card={queue[index]} onRate={rate} onSkip={advance} />
        </View>
      ) : (
        <View style={styles.stage}>
          {visible
            .map((card, i) => (
              <Flashcard
                key={card.id}
                ref={i === 0 ? topCardRef : null}
                card={card}
                depth={i}
                onRate={rate}
                onExplain={askWhy}
              />
            ))
            .reverse()}
        </View>
      )}

      {mode === 'cards' ? (
        <View style={[styles.rateRow, { paddingBottom: insets.bottom + space(4) }]}>
          <RateButton label="Again" color={colors.again} onPress={() => requestRate(RATING.AGAIN)} />
          <RateButton label="Hard" color={colors.hard} onPress={() => requestRate(RATING.HARD)} />
          <RateButton label="Got it" color={colors.good} onPress={() => requestRate(RATING.GOOD)} />
        </View>
      ) : mode === 'blitz' ? (
        <View style={[styles.rateRow, { paddingBottom: insets.bottom + space(4) }]}>
          <RateButton label="Nope" color={colors.again} onPress={() => requestRate(RATING.AGAIN)} />
          <RateButton label="Got it" color={colors.good} onPress={() => requestRate(RATING.GOOD)} />
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}

      <ExplainSheet
        card={explain?.card}
        visible={!!explain}
        loading={!!explain?.loading}
        explanation={explain?.explanation}
        error={explain?.error}
        onClose={() => setExplain(null)}
      />

      <CardEditor
        card={queue[index]}
        visible={editing}
        onSave={saveCard}
        onDelete={deleteCard}
        onClose={() => setEditing(false)}
      />
    </View>
  );
}

// A chip that squashes on press and springs back - same pop as the shutter,
// so the whole app feels like one material.
function ModeChip({ label, active, onPress }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animated}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.9, motion.pop);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.pop);
        }}
        onPress={onPress}
        style={[styles.modeChip, active && styles.modeChipActive]}
        hitSlop={6}
      >
        <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function RateButton({ label, color, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.rateButton, { borderColor: color + '55' }]}>
      <Text style={[styles.rateLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(6),
  },
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  edit: { ...type.body, fontWeight: '700', color: colors.accent },
  counter: { ...type.mono, color: colors.textDim },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(6),
    marginTop: space(2),
  },
  deckTitle: {
    ...type.title,
    fontSize: 22,
    color: colors.text,
  },
  deckSubject: { ...type.mono, color: colors.textFaint, marginTop: 2 },
  track: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 2,
    marginHorizontal: space(6),
    marginTop: space(4),
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.accent },
  stage: { flex: 1, marginTop: space(6) },
  stageFlat: { flex: 1, marginTop: space(4) },
  modes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(6),
    marginTop: space(4),
  },
  modeChip: {
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { ...type.label, fontSize: 12, color: colors.textDim },
  modeTextActive: { color: colors.accentInk },
  clock: { ...type.mono, color: colors.accent, marginLeft: 'auto' },
  rateRow: {
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(6),
  },
  rateButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  rateLabel: { ...type.body, fontWeight: '700' },
  summary: { alignItems: 'center', paddingHorizontal: space(10), alignSelf: 'stretch' },
  summaryScore: { ...type.hero, fontSize: 72, color: colors.accent },
  summaryTotal: { fontSize: 40, color: colors.textFaint },
  summaryLabel: { ...type.mono, color: colors.textDim, marginTop: space(1) },
  summaryBody: {
    ...type.body,
    color: colors.textDim,
    marginTop: space(6),
    textAlign: 'center',
  },
  afterRow: { flexDirection: 'row', gap: space(8), marginTop: space(6) },
  afterLink: { ...type.body, fontWeight: '700', color: colors.textDim },
  feedbackLink: { ...type.mono, color: colors.textFaint },
});

// Ticks the score up from 0 over ~600ms. Plain state rather than a worklet
// because Text can't take a shared value directly, and 20 renders is nothing.
function CountUp({ to }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to <= 0) return;
    const start = Date.now();
    const dur = 600;
    let raf;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}
