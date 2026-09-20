import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import ExamCard from '../components/ExamCard';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { deckProgress, dueCount } from '../lib/srs';
import { upcoming } from '../lib/exams';
import { shareDeck } from '../lib/share';
import { dismissBackupNudge, onStatus, shouldNudgeBackup } from '../lib/cloud';
import { colors, motion, radius, space, type } from '../theme';
import { alert } from '../lib/alert';

export default function LibraryScreen({
  decks,
  exams = [],
  streak = 0,
  onAddExam,
  onOpenExam,
  onEditExam,
  onOpen,
  onReviewDue,
  onAddPages,
  onRename,
  onOpenSource,
  talkCount = 0,
  onOpenTalks,
  onCreate,
  onSettings,
  onClose,
  onDelete,
  onLoadSample,
}) {
  const insets = useSafeAreaInsets();
  // "Back this up?" - once, for guests with a few decks. Re-checked when
  // the deck count or sign-in state changes, so it leaves the moment
  // they sign in.
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => shouldNudgeBackup(decks.length).then((v) => live && setNudge(v));
    check();
    const stop = onStatus(check);
    return () => {
      live = false;
      stop();
    };
  }, [decks.length]);
  const totalDue = decks.reduce((n, d) => n + dueCount(d.cards), 0);
  const soon = upcoming(exams);

  const confirmDelete = (deck) => {
    alert('Delete deck?', `"${deck.title}" and its cards will be gone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(deck.id) },
    ]);
  };

  // Long-press menu. A native alert rather than a custom sheet: three actions
  // is the most this needs, and it matches the delete confirm already here.
  const deckActions = (deck) => {
    alert(deck.title, null, [
      ...(deck.source
        ? [{ text: deck.source.kind === 'youtube' ? 'Open the video' : 'Open the PDF', onPress: () => onOpenSource(deck) }]
        : []),
      { text: 'Rename', onPress: () => onRename(deck) },
      { text: 'Add pages to this deck', onPress: () => onAddPages(deck) },
      { text: 'Share', onPress: () => shareDeck(deck) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(deck) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your decks</Text>
          {streak > 1 ? (
            <Animated.Text entering={ZoomIn.springify().damping(12).delay(200)} style={styles.streakLine}>
              {streak}-DAY STREAK
            </Animated.Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          {onSettings ? (
            <Pressable onPress={onSettings} hitSlop={16}>
              <Text style={styles.gear}>⚙</Text>
            </Pressable>
          ) : null}
          {onCreate ? (
            <Pressable onPress={onCreate} hitSlop={16}>
              <Text style={styles.newLink}>New</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.close}>Camera</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={decks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + space(10) }}
        ListHeaderComponent={
          <View>
          {/* Exams first: this is the part of the app that knows what the
              week looks like. Empty state is a single quiet line - most people
              add their first exam after their first deck, not before. */}
          <View style={styles.week}>
            <View style={styles.weekHead}>
              <Text style={styles.weekTitle}>THIS WEEK</Text>
              {onAddExam ? (
                <Pressable onPress={onAddExam} hitSlop={12}>
                  <Text style={styles.weekAdd}>+ Exam</Text>
                </Pressable>
              ) : null}
            </View>
            {soon.length ? (
              soon.map((e, i) => (
                <ExamCard
                  key={e.id}
                  exam={e}
                  decks={decks}
                  index={i}
                  onPress={() => onOpenExam(e)}
                  onLongPress={() => onEditExam(e)}
                />
              ))
            ) : (
              <Pressable onPress={onAddExam} style={styles.weekEmpty}>
                <Text style={styles.weekEmptyText}>
                  Got an exam coming? Add it and Cram counts down and keeps the right decks in front of you.
                </Text>
              </Pressable>
            )}
          </View>

          {/* Only shown with two or more decks - with one, tapping the deck is
              the same thing and the button would just be noise. */}
          {decks.length > 1 && totalDue > 0 ? (
            <Pressable style={styles.due} onPress={onReviewDue}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dueTitle}>Review what's due</Text>
                <Text style={styles.dueBody}>
                  {totalDue} {totalDue === 1 ? 'card' : 'cards'} across {decks.length} decks
                </Text>
              </View>
              <Text style={styles.dueCta}>Start</Text>
            </Pressable>
          ) : null}

          {nudge && onSettings ? (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.nudge}>
              <Text style={styles.nudgeTitle}>Back this up?</Text>
              <Text style={styles.nudgeBody}>
                {decks.length} decks live only on this phone. Sign in and they follow you to the next one.
              </Text>
              <View style={styles.nudgeRow}>
                <Pressable
                  onPress={() => {
                    dismissBackupNudge();
                    setNudge(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.nudgeLater}>Not now</Text>
                </Pressable>
                <Pressable onPress={onSettings} hitSlop={8}>
                  <Text style={styles.nudgeCta}>Sign in</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
            {onOpenTalks && talkCount ? (
              <Pressable onPress={onOpenTalks} style={styles.talksRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.talksTitle}>My talks</Text>
                  <Text style={styles.talksSub}>
                    {talkCount} {talkCount === 1 ? 'recording' : 'recordings'} of you explaining things
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : null}
            {decks.length ? <Text style={styles.sectionTitle}>YOUR DECKS</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Mascot mood="idle" size={80} style={{ marginBottom: space(5) }} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Point the camera at a slide or a page of notes - or write the cards yourself.
            </Text>
            {onCreate ? (
              <PrimaryButton
                label="Write your own"
                variant="solid"
                onPress={onCreate}
                style={{ marginTop: space(8), alignSelf: 'stretch' }}
              />
            ) : null}
            {onLoadSample ? (
              <PrimaryButton
                label="Load two sample decks"
                variant="ghost"
                onPress={onLoadSample}
                style={{ marginTop: space(3), alignSelf: 'stretch' }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const pct = Math.round(deckProgress(item.cards) * 100);
          const due = dueCount(item.cards);
          return (
            <Animated.View entering={FadeInDown.delay(index * 45).duration(320)}>
              <Pressable
                style={styles.card}
                onPress={() => onOpen(item)}
                onLongPress={() => deckActions(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardPct}>{pct}%</Text>
                </View>
                {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
                <View style={styles.track}>
                  <ProgressFill pct={pct} delay={index * 45 + 200} />
                </View>
                <Text style={styles.meta}>
                  {item.source ? (
                    <Text style={styles.metaTag}>{item.source.kind === 'youtube' ? 'VIDEO' : 'PDF'}  ·  </Text>
                  ) : null}
                  {item.cards.length} cards
                  {due > 0 ? <Text style={styles.metaDue}>  ·  {due} due</Text> : null}
                </Text>
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

// Grows from zero when the list appears. Progress you watch fill up reads as
// progress; a bar that is simply there reads as decoration.
function ProgressFill({ pct, delay }) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = withDelay(delay, withSpring(pct, motion.soft));
  }, [pct]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[styles.fill, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
  },
  title: { ...type.title, fontSize: 26, color: colors.text },
  streakLine: { ...type.mono, fontSize: 10, color: colors.accent, marginTop: 2 },
  sectionTitle: {
    ...type.mono,
    color: colors.textFaint,
    paddingHorizontal: space(6),
    marginTop: space(7),
    marginBottom: space(3),
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space(4), flexShrink: 0 },
  newLink: { ...type.body, fontWeight: '700', color: colors.textDim },
  gear: { fontSize: 20, color: colors.textDim },
  close: { ...type.body, fontWeight: '700', color: colors.accent },
  week: { paddingHorizontal: space(6), marginTop: space(5) },
  weekHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space(3),
  },
  weekTitle: { ...type.mono, color: colors.textFaint },
  weekAdd: { ...type.body, fontSize: 14, fontWeight: '700', color: colors.accent },
  weekEmpty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    padding: space(4),
  },
  weekEmptyText: { ...type.body, fontSize: 14, color: colors.textDim },
  talksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space(6),
    marginTop: space(4),
    padding: space(4),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  talksTitle: { ...type.body, fontWeight: '700', color: colors.text },
  talksSub: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textFaint },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space(6),
    marginTop: space(5),
    padding: space(5),
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  dueTitle: { ...type.body, fontWeight: '800', color: colors.accentInk },
  dueBody: { ...type.body, fontSize: 14, color: colors.accentInk, opacity: 0.7, marginTop: 2 },
  dueCta: { ...type.label, color: colors.accentInk },
  nudge: {
    marginHorizontal: space(6),
    marginTop: space(5),
    padding: space(5),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '33',
  },
  nudgeTitle: { ...type.body, fontWeight: '700', color: colors.text },
  nudgeBody: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: 2 },
  nudgeRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(6), marginTop: space(4) },
  nudgeLater: { ...type.label, color: colors.textFaint },
  nudgeCta: { ...type.label, color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(5),
    marginHorizontal: space(6),
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
  metaDue: { color: colors.accent, fontWeight: '700' },
  metaTag: { ...type.mono, fontSize: 11, color: colors.textFaint },
  empty: { alignItems: 'center', paddingTop: space(16), paddingHorizontal: space(10) },
  emptyTitle: { ...type.title, fontSize: 20, color: colors.text },
  emptyBody: {
    ...type.body,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space(3),
  },
});
