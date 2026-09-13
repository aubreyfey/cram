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
import Confetti from '../components/Confetti';
import Mascot from '../components/Mascot';
import Flashcard from '../components/Flashcard';
import PrimaryButton from '../components/PrimaryButton';
import { RATING, dueCards, schedule } from '../lib/srs';
import { colors, motion, radius, space, type } from '../theme';

export default function StudyScreen({ deck, onClose, onUpdateDeck }) {
  const queue = useMemo(() => dueCards(deck.cards), [deck.id]);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const topCardRef = useRef(null);

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const insets = useSafeAreaInsets();
  const done = index >= queue.length;

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
    onUpdateDeck({
      ...deck,
      cards: deck.cards.map((c) => (c.id === updated.id ? updated : c)),
    });

    setRatings((r) => ({ ...r, [rating]: (r[rating] || 0) + 1 }));
    const next = index + 1;
    progress.value = withSpring(next / queue.length, motion.soft);
    setIndex(next);
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
          <Text style={styles.summaryLabel}>cards you knew</Text>
          <Text style={styles.summaryBody}>
            {cleanSweep
              ? 'Clean sweep. Nothing to redo.'
              : `${ratings[RATING.AGAIN]} coming back tomorrow.`}
          </Text>
          <PrimaryButton label="Done" onPress={onClose} style={{ marginTop: space(10) }} />
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
      </View>

      <Text style={styles.deckTitle} numberOfLines={1}>
        {deck.title}
      </Text>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, progressStyle]} />
      </View>

      <View style={styles.stage}>
        {visible
          .map((card, i) => (
            <Flashcard
              key={card.id}
              ref={i === 0 ? topCardRef : null}
              card={card}
              depth={i}
              onRate={rate}
            />
          ))
          .reverse()}
      </View>

      <View style={[styles.rateRow, { paddingBottom: insets.bottom + space(4) }]}>
        <RateButton label="Again" color={colors.again} onPress={() => requestRate(RATING.AGAIN)} />
        <RateButton label="Hard" color={colors.hard} onPress={() => requestRate(RATING.HARD)} />
        <RateButton label="Got it" color={colors.good} onPress={() => requestRate(RATING.GOOD)} />
      </View>
    </View>
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
  counter: { ...type.mono, color: colors.textDim },
  deckTitle: {
    ...type.title,
    fontSize: 22,
    color: colors.text,
    paddingHorizontal: space(6),
    marginTop: space(3),
  },
  track: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 2,
    marginHorizontal: space(6),
    marginTop: space(4),
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.accent },
  stage: { flex: 1, marginTop: space(8) },
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
