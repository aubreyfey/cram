import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { countdown, daysUntil, examStats } from '../lib/exams';
import { colors, radius, space, type } from '../theme';

// One exam, as the student sees it: what, when, how ready. The countdown is
// the loudest thing on the card because it is the thing that changes their
// evening. Urgency shifts the accent from lime to amber to rose as the day
// gets close - one signal, no icons.
export default function ExamCard({ exam, decks, index = 0, onPress, onLongPress }) {
  const n = daysUntil(exam.date);
  const s = examStats(exam, decks);
  const done = n < 0;
  const tone = done ? colors.textFaint : n <= 1 ? colors.again : n <= 3 ? colors.hard : colors.accent;
  const pct = Math.round(s.progress * 100);

  return (
    <Animated.View entering={FadeInDown.delay(index * 45).duration(320)}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.card, { borderColor: tone + '55' }, done && styles.cardDone]}
      >
        <View style={styles.top}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
            {exam.title}
          </Text>
          <Text style={[styles.when, { color: tone }]}>{countdown(exam.date).toUpperCase()}</Text>
        </View>

        {s.decks ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone }]} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {s.decks} {s.decks === 1 ? 'deck' : 'decks'} · {s.cards} cards · {pct}% learned
              </Text>
              {s.due > 0 && !done ? (
                <Text style={[styles.due, { color: tone }]}>{s.due} due</Text>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={styles.metaText}>No decks linked yet - hold to edit</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(5),
    marginBottom: space(3),
    borderWidth: 1.5,
  },
  cardDone: { opacity: 0.5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(3) },
  title: { ...type.body, fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  titleDone: { textDecorationLine: 'line-through' },
  when: { ...type.mono },
  track: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 2,
    marginTop: space(4),
    overflow: 'hidden',
  },
  fill: { height: 3 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(3) },
  metaText: { ...type.body, fontSize: 13, color: colors.textDim },
  due: { ...type.body, fontSize: 13, fontWeight: '700' },
});
