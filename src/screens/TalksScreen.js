import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { fmtDuration } from '../lib/talks';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// Your own podcast: every time you explained something out loud, in order.
// One player, whichever talk is tapped. Play it on the bus; make cards
// from it when you get home.
export default function TalksScreen({ talks, decks, onRecord, onMakeCards, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return () => player.pause();
  }, []);

  const toggle = (talk) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Backed up from another phone: the transcript came along, the audio
    // stayed where it was recorded.
    if (!talk.uri) {
      alert('Recorded on another phone', 'The audio stayed there. The transcript is here, and cards can still be made from it.');
      return;
    }
    if (current?.id === talk.id) {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish) player.seekTo(0);
        player.play();
      }
      return;
    }
    setCurrent(talk);
    player.replace({ uri: talk.uri });
    player.play();
  };

  const actions = (talk) =>
    alert(talk.title, null, [
      ...(talk.transcript?.length >= 40 ? [{ text: 'Make cards from this', onPress: () => onMakeCards(talk) }] : []),
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (current?.id === talk.id) {
            player.pause();
            setCurrent(null);
          }
          onDelete(talk.id);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const deckName = (id) => decks.find((d) => d.id === id)?.title;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Decks</Text>
        </Pressable>
        <Text style={styles.title}>My talks</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(28) }]} showsVerticalScrollIndicator={false}>
        {talks.length ? (
          talks.map((t, i) => {
            const active = current?.id === t.id;
            const pct = active && status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
            return (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 40).duration(280)}>
                <Pressable onPress={() => toggle(t)} onLongPress={() => actions(t)} style={[styles.card, active && styles.cardActive]}>
                  <View style={styles.row}>
                    <View style={[styles.play, active && status.playing && styles.playOn]}>
                      <Text style={[styles.playGlyph, active && status.playing && { color: colors.accentInk }]}>
                        {active && status.playing ? '❚❚' : '▶'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={styles.meta}>
                        {fmtDuration(t.duration)} · {ago(t.createdAt)}
                        {t.deckId && deckName(t.deckId) ? ` · ${deckName(t.deckId)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {active ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                    </View>
                  ) : null}
                  {t.transcript ? (
                    <Text style={styles.snippet} numberOfLines={active ? 12 : 2}>
                      {t.transcript}
                    </Text>
                  ) : (
                    <Text style={[styles.snippet, { color: colors.textFaint }]}>No transcript</Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          })
        ) : (
          <View style={styles.empty}>
            <Mascot mood="idle" size={72} />
            <Text style={styles.emptyTitle}>Nothing recorded yet</Text>
            <Text style={styles.emptyBody}>
              Explain a deck out loud after you study it. If you can say it without looking, it's yours.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton label="Record a talk" onPress={onRecord} />
      </View>
    </View>
  );
}

function ago(ts) {
  const d = Math.round((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(6) },
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56 },
  title: { ...type.body, fontWeight: '800', fontSize: 17, color: colors.text },
  body: { paddingHorizontal: space(6), paddingTop: space(4) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    marginBottom: space(3),
  },
  cardActive: { borderColor: colors.accent + '66' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  play: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  playOn: { backgroundColor: colors.accent },
  playGlyph: { fontSize: 14, fontWeight: '800', color: colors.accent },
  cardTitle: { ...type.body, fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  track: { height: 3, backgroundColor: colors.line, borderRadius: 2, marginTop: space(3), overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
  snippet: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(3) },
  empty: { alignItems: 'center', paddingTop: space(16), paddingHorizontal: space(8) },
  emptyTitle: { ...type.title, fontSize: 20, color: colors.text, marginTop: space(5) },
  emptyBody: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(3) },
  footer: {
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
});
