import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, space, type } from '../theme';

// Someone sent a deck. Show what it is, let them keep it. This is the
// first screen many people will ever see of Cram - a friend's chem deck
// in a group chat - so it has to work with zero context: what is this,
// who is it from, what happens when I tap the button.
//
//   state: { loading } | { error } | { deck }
const PREVIEW = 6;

export default function SharedDeckScreen({ state, onSave, onClose, saving }) {
  const insets = useSafeAreaInsets();
  const deck = state?.deck;
  const n = deck?.cards?.length ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>{Platform.OS === 'web' ? 'Cram' : 'Close'}</Text>
        </Pressable>
        <Text style={styles.kicker}>SHARED DECK</Text>
        <View style={{ width: 56 }} />
      </View>

      {state?.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.dim}>Opening the deck…</Text>
        </View>
      ) : state?.error ? (
        <View style={styles.center}>
          <Mascot mood="oops" size={80} />
          <Text style={styles.title}>Couldn't open that</Text>
          <Text style={styles.dim}>{state.error}</Text>
          <PrimaryButton label="Back to Cram" variant="ghost" onPress={onClose} style={{ marginTop: space(6), alignSelf: 'stretch' }} />
        </View>
      ) : deck ? (
        <>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: space(40) }]} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
              <Mascot mood="happy" size={72} />
              <Text style={styles.title}>{deck.title}</Text>
              <Text style={styles.meta}>
                {n} {n === 1 ? 'card' : 'cards'}
                {deck.subject ? ` · ${deck.subject}` : ''}
                {deck.by ? ` · from ${deck.by}` : ''}
              </Text>
            </Animated.View>

            {deck.cards.slice(0, PREVIEW).map((c, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(80 + i * 40).duration(280)} style={styles.card}>
                <Text style={styles.q}>{c.front}</Text>
                <Text style={styles.a} numberOfLines={2}>
                  {c.back}
                </Text>
              </Animated.View>
            ))}
            {n > PREVIEW ? <Text style={styles.more}>and {n - PREVIEW} more</Text> : null}
          </ScrollView>

          <View style={[styles.foot, { paddingBottom: insets.bottom + space(4) }]}>
            <PrimaryButton label={saving ? 'Saving…' : 'Save to my decks'} onPress={saving ? undefined : onSave} />
            <Text style={styles.footNote}>
              {Platform.OS === 'web'
                ? 'Saves here, in this browser. Starts fresh - your progress, not theirs.'
                : 'Starts fresh - your progress, not theirs.'}
            </Text>
          </View>
        </>
      ) : null}
    </View>
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
  close: { ...type.body, fontWeight: '700', color: colors.accent, width: 56 },
  kicker: { ...type.mono, color: colors.textFaint },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8), gap: space(3) },
  body: { paddingHorizontal: space(6), paddingTop: space(4) },
  hero: { alignItems: 'center', marginBottom: space(6), gap: space(2) },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  meta: { ...type.body, color: colors.textDim, textAlign: 'center' },
  dim: { ...type.body, color: colors.textDim, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    marginBottom: space(3),
  },
  q: { ...type.body, fontWeight: '700', color: colors.text },
  a: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(1) },
  more: { ...type.mono, color: colors.textFaint, textAlign: 'center', marginTop: space(2) },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space(6),
    paddingTop: space(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footNote: { ...type.body, fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: space(3) },
});
