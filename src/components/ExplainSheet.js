import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import Mascot from './Mascot';
import PrimaryButton from './PrimaryButton';
import { colors, radius, space, type } from '../theme';

// The answer, then why. Volt thinks while it loads, then reads along. Kept
// as a sheet rather than inline on the card: an explanation is a detour,
// and the card should look the same when you come back to it.
export default function ExplainSheet({ card, visible, loading, explanation, error, onClose }) {
  const insets = useSafeAreaInsets();
  if (!card) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Text style={styles.kicker}>WHY?</Text>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(8) }]}>
          <Text style={styles.question}>{card.front}</Text>
          <View style={styles.answer}>
            <Text style={styles.answerKicker}>ANSWER</Text>
            <Text style={styles.answerText}>{card.back}</Text>
          </View>

          <View style={styles.volt}>
            <Mascot mood={loading ? 'thinking' : error ? 'oops' : 'happy'} size={44} />
            <View style={{ flex: 1 }}>
              {loading ? (
                <Text style={styles.thinking}>Volt is working it out…</Text>
              ) : error ? (
                <Text style={styles.error}>{error}</Text>
              ) : (
                <Animated.Text entering={FadeIn.duration(260)} style={styles.explanation}>
                  {explanation}
                </Animated.Text>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
          <PrimaryButton label="Got it" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(6),
    paddingBottom: space(3),
  },
  kicker: { ...type.mono, color: colors.accent },
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  body: { paddingHorizontal: space(6), paddingTop: space(2) },
  question: { ...type.card, fontSize: 21, lineHeight: 28, color: colors.text },
  answer: {
    marginTop: space(5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(5),
  },
  answerKicker: { ...type.mono, color: colors.textFaint, marginBottom: space(2) },
  answerText: { ...type.body, fontSize: 16, color: colors.textDim },
  volt: { flexDirection: 'row', alignItems: 'flex-start', gap: space(4), marginTop: space(7) },
  thinking: { ...type.body, color: colors.textDim, marginTop: space(2) },
  error: { ...type.body, color: colors.again, marginTop: space(2) },
  explanation: { ...type.body, fontSize: 17, lineHeight: 26, color: colors.text, marginTop: space(1) },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
