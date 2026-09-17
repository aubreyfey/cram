import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import PrimaryButton from './PrimaryButton';
import { RATING } from '../lib/srs';
import { colors, radius, space, type } from '../theme';

// Type the answer, then see the real one. Recall with nothing to lean on is
// the hardest of the modes and the one that sticks; the honesty check is
// automatic but the final call is the student's, because "same idea, other
// words" is right and no string match knows that.
const STOP = new Set(
  'a an the of to in on at for and or is are was were be by with as it its this that these those from into which'.split(' '),
);

function tokens(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

// Fraction of the answer's meaningful words that show up in what was typed.
export function overlap(typed, answer) {
  const want = new Set(tokens(answer));
  if (!want.size) return 0;
  const got = new Set(tokens(typed));
  let hit = 0;
  for (const w of want) if (got.has(w)) hit++;
  return hit / want.size;
}

export default function WriteStage({ card, onRate }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setText('');
    setChecked(false);
  }, [card.id]);

  const score = useMemo(() => (checked ? overlap(text, card.back) : 0), [checked, text, card.back]);
  const verdict = score >= 0.6 ? 'right' : score >= 0.3 ? 'close' : 'miss';

  const check = () => {
    if (!text.trim()) return;
    setChecked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const VERDICT = {
    right: { label: 'Looks right', color: colors.good },
    close: { label: 'Close - compare', color: colors.hard },
    miss: { label: 'Not quite', color: colors.again },
  }[verdict];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.question}>
          <Text style={styles.kicker}>QUESTION</Text>
          <Text style={styles.prompt}>{card.front}</Text>
          {card.hint ? <Text style={styles.hint}>{card.hint}</Text> : null}
        </View>

        <TextInput
          style={[styles.input, checked && styles.inputLocked]}
          value={text}
          onChangeText={setText}
          editable={!checked}
          multiline
          placeholder="Your answer"
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={check}
          blurOnSubmit
          returnKeyType="done"
        />

        {!checked ? (
          <View style={styles.actions}>
            <PrimaryButton label="Check" onPress={check} />
            <Pressable onPress={() => setChecked(true)} hitSlop={8} style={styles.skip}>
              <Text style={styles.skipText}>Show me the answer</Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            <View style={styles.answer}>
              <View style={styles.answerHead}>
                <Text style={[styles.kicker, { position: 'relative', top: 0, left: 0, color: colors.accent }]}>
                  ANSWER
                </Text>
                {text.trim() ? (
                  <Text style={[styles.verdict, { color: VERDICT.color }]}>{VERDICT.label}</Text>
                ) : null}
              </View>
              <Text style={styles.answerText}>{card.back}</Text>
            </View>
            <Text style={styles.selfGrade}>Be honest - did you have it?</Text>
            <View style={styles.rateRow}>
              <Pressable
                onPress={() => onRate(RATING.AGAIN)}
                style={[styles.rateButton, { borderColor: colors.again + '55' }]}
              >
                <Text style={[styles.rateLabel, { color: colors.again }]}>No</Text>
              </Pressable>
              <Pressable
                onPress={() => onRate(RATING.HARD)}
                style={[styles.rateButton, { borderColor: colors.hard + '55' }]}
              >
                <Text style={[styles.rateLabel, { color: colors.hard }]}>Mostly</Text>
              </Pressable>
              <Pressable
                onPress={() => onRate(RATING.GOOD)}
                style={[styles.rateButton, { borderColor: colors.good + '55' }]}
              >
                <Text style={[styles.rateLabel, { color: colors.good }]}>Yes</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: space(6), paddingBottom: space(6) },
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
  hint: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(3) },
  input: {
    ...type.body,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    minHeight: 96,
    textAlignVertical: 'top',
    marginTop: space(4),
  },
  inputLocked: { borderColor: colors.line, color: colors.textDim },
  actions: { marginTop: space(4) },
  skip: { alignSelf: 'center', marginTop: space(4) },
  skipText: { ...type.body, fontSize: 14, color: colors.textDim },
  answer: {
    marginTop: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: space(5),
  },
  answerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verdict: { ...type.label },
  answerText: { ...type.body, fontSize: 17, lineHeight: 25, color: colors.text, marginTop: space(3) },
  selfGrade: { ...type.mono, color: colors.textFaint, textAlign: 'center', marginTop: space(5) },
  rateRow: { flexDirection: 'row', gap: space(3), marginTop: space(3) },
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
});
