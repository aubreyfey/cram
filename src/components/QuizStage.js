import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Figure from './Figure';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { RATING } from '../lib/srs';
import { colors, radius, space, type } from '../theme';

// Multiple choice. The wrong answers are other cards' backs from the same
// deck, so they are plausible - a distractor from a different subject would
// give the game away. Recognition is easier than recall, which is the point:
// it is the mode for the first pass over new material, before flashcards.
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(card, pool) {
  const seen = new Set([card.back]);
  const others = shuffle(pool)
    .filter((c) => c.id !== card.id && !seen.has(c.back) && seen.add(c.back))
    .slice(0, 3)
    .map((c) => c.back);
  return shuffle([card.back, ...others]);
}

export default function QuizStage({ card, pool, onRate }) {
  const options = useMemo(() => buildOptions(card, pool), [card.id]);
  const [picked, setPicked] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    setPicked(null);
    return () => clearTimeout(timer.current);
  }, [card.id]);

  const choose = (opt) => {
    if (picked != null) return;
    setPicked(opt);
    const right = opt === card.back;
    Haptics.notificationAsync(
      right ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    // Long enough to read the correct answer when you got it wrong; short
    // enough that a streak of right answers feels quick.
    timer.current = setTimeout(() => onRate(right ? RATING.GOOD : RATING.AGAIN), right ? 550 : 1600);
  };

  const tooFew = options.length < 2;

  return (
    <View style={styles.root}>
      <View style={styles.question}>
        <Text style={styles.kicker}>QUESTION</Text>
        <Figure figure={card.figure} side="front" height={120} />
        <Text style={styles.prompt}>{card.front}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.options} showsVerticalScrollIndicator={false}>
        {tooFew ? (
          <Text style={styles.note}>A deck needs a few cards before Quiz has anything to hide the answer among.</Text>
        ) : null}
        {options.map((opt, i) => {
          const isRight = opt === card.back;
          const state =
            picked == null ? 'idle' : isRight ? 'right' : opt === picked ? 'wrong' : 'dim';
          return (
            <Animated.View key={opt + i} entering={FadeInDown.delay(i * 50).duration(260)}>
              <Pressable
                onPress={() => choose(opt)}
                style={[styles.option, styles[state]]}
                disabled={picked != null}
              >
                <Text style={styles.letter}>{'ABCD'[i]}</Text>
                <Text style={[styles.optionText, state === 'dim' && { color: colors.textFaint }]}>
                  {opt}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space(6) },
  question: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(6),
    paddingTop: space(9),
  },
  kicker: { ...type.mono, color: colors.textFaint, position: 'absolute', top: space(4), left: space(6) },
  prompt: { ...type.card, fontSize: 20, lineHeight: 27, color: colors.text },
  options: { paddingTop: space(4), paddingBottom: space(4), gap: space(2) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  idle: {},
  right: { borderColor: colors.good, backgroundColor: colors.good + '1A' },
  wrong: { borderColor: colors.again, backgroundColor: colors.again + '1A' },
  dim: { opacity: 0.45 },
  letter: { ...type.mono, color: colors.accent, width: 16 },
  optionText: { ...type.body, fontSize: 15, lineHeight: 21, color: colors.text, flex: 1 },
  note: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center', marginBottom: space(3) },
});
