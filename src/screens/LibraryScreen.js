import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { deckProgress } from '../lib/srs';
import { colors, radius, space, type } from '../theme';

export default function LibraryScreen({
  decks,
  onOpen,
  onClose,
  onDelete,
  isPro,
  onUpgrade,
  onLoadSample,
}) {
  const insets = useSafeAreaInsets();

  const confirmDelete = (deck) => {
    Alert.alert('Delete deck?', `"${deck.title}" and its cards will be gone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(deck.id) },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your decks</Text>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Camera</Text>
        </Pressable>
      </View>

      {!isPro ? (
        <Pressable style={styles.upsell} onPress={onUpgrade}>
          <View style={{ flex: 1 }}>
            <Text style={styles.upsellTitle}>Unlimited cards</Text>
            <Text style={styles.upsellBody}>Semester Pass covers you to finals</Text>
          </View>
          <Text style={styles.upsellCta}>$19.99</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={decks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: space(6), paddingBottom: insets.bottom + space(10) }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Mascot mood="idle" size={80} style={{ marginBottom: space(5) }} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Point the camera at a slide or a page of notes to make your first deck.
            </Text>
            {onLoadSample ? (
              <PrimaryButton
                label="Load a sample deck"
                variant="ghost"
                onPress={onLoadSample}
                style={{ marginTop: space(8) }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const pct = Math.round(deckProgress(item.cards) * 100);
          return (
            <Animated.View entering={FadeInDown.delay(index * 45).duration(320)}>
              <Pressable
                style={styles.card}
                onPress={() => onOpen(item)}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardPct}>{pct}%</Text>
                </View>
                {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.meta}>{item.cards.length} cards</Text>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
  },
  title: { ...type.title, color: colors.text },
  close: { ...type.body, fontWeight: '700', color: colors.accent },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space(6),
    marginTop: space(5),
    padding: space(5),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '33',
  },
  upsellTitle: { ...type.body, fontWeight: '700', color: colors.text },
  upsellBody: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: 2 },
  upsellCta: { ...type.body, fontWeight: '800', color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(5),
    marginBottom: space(3),
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space(4) },
  cardTitle: { ...type.body, fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  cardPct: { ...type.mono, color: colors.accent },
  subject: { ...type.mono, color: colors.textFaint, marginTop: space(1) },
  track: {
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 2,
    marginTop: space(4),
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: colors.accent },
  meta: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: space(3) },
  empty: { alignItems: 'center', paddingTop: space(24), paddingHorizontal: space(8) },
  emptyTitle: { ...type.title, fontSize: 20, color: colors.text },
  emptyBody: {
    ...type.body,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space(3),
  },
});
