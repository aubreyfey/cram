import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { countdown, daysUntil, prettyDate } from '../lib/exams';
import { studyPlan, todayLine } from '../lib/plan';
import { alert } from '../lib/alert';
import { exportGuideMarkdown } from '../lib/markdown';
import { colors, radius, space, type } from '../theme';

// One exam, as a place. The countdown, the plan for today, the weak spots,
// and the study guide - then a single big button that starts the right
// session. The guide is the only thing here that costs a request; it is
// cached on the exam, so it happens once.
export default function ExamScreen({ exam, decks, onStudy, onEdit, onGuide, onTalk, onClose }) {
  const insets = useSafeAreaInsets();
  const plan = useMemo(() => studyPlan(exam, decks), [exam, decks]);
  const [making, setMaking] = useState(false);
  const n = daysUntil(exam.date);
  const tone = n <= 1 ? colors.again : n <= 3 ? colors.hard : colors.accent;
  const guide = exam.guide;
  const stale = guide && guide.cardCount !== plan.total;

  const makeGuide = async () => {
    if (making) return;
    setMaking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onGuide(exam, plan);
    } catch (e) {
      alert("Couldn't write the guide", e.message);
    } finally {
      setMaking(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Decks</Text>
        </Pressable>
        <Pressable onPress={() => onEdit(exam)} hitSlop={16}>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(28) }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{exam.title}</Text>
        <Text style={[styles.when, { color: tone }]}>
          {countdown(exam.date).toUpperCase()} · {prettyDate(exam.date).toUpperCase()}
        </Text>

        {/* Progress: one bar, three numbers. */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(plan.progress * 100)}%`, backgroundColor: tone }]} />
        </View>
        <View style={styles.stats}>
          <Stat n={plan.learned} label="learned" />
          <Stat n={plan.remaining} label="to go" />
          <Stat n={plan.due} label="due now" tone={plan.due ? tone : undefined} />
        </View>

        {/* Today */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.kicker}>TODAY</Text>
            {plan.total && !plan.onTrack ? <Text style={[styles.kicker, { color: colors.again }]}>BEHIND</Text> : null}
          </View>
          <Text style={styles.today}>{todayLine(plan)}</Text>
          {plan.total ? (
            <Text style={styles.sub}>
              {plan.days > 1 ? `${plan.perDay} new a day gets you there with a day to spare. ` : ''}
              {plan.mode.label} mode: {plan.mode.why}
            </Text>
          ) : null}
        </Animated.View>

        {onTalk && plan.total ? (
          <Pressable onPress={() => onTalk(exam)} style={styles.talkRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.talkTitle}>Talk through it</Text>
              <Text style={styles.sub}>Explain the whole exam out loud, no cards. Keep the recording.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}

        {/* Weak spots */}
        {plan.weak.length ? (
          <Animated.View entering={FadeInDown.delay(60).duration(280)} style={styles.card}>
            <Text style={styles.kicker}>WEAK SPOTS</Text>
            <Text style={styles.sub}>Cards you've got wrong. They come back more often on their own.</Text>
            {plan.weak.map((c) => (
              <Text key={c.id} style={styles.weak} numberOfLines={2}>
                • {c.front}
              </Text>
            ))}
          </Animated.View>
        ) : null}

        {/* Study guide */}
        <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.kicker}>STUDY GUIDE</Text>
            {guide ? (
              <View style={styles.headActions}>
                <Pressable onPress={() => exportGuideMarkdown(exam, guide).catch(() => {})} hitSlop={8}>
                  <Text style={styles.redo}>Export</Text>
                </Pressable>
                <Pressable onPress={makeGuide} hitSlop={8} disabled={making}>
                  <Text style={styles.redo}>{making ? 'Rewriting…' : stale ? 'Decks changed - rewrite' : 'Rewrite'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {!plan.total ? (
            <Text style={styles.sub}>Link decks to this exam first - the guide is written from your cards.</Text>
          ) : !guide ? (
            <>
              <View style={styles.guideEmpty}>
                <Mascot mood={making ? 'thinking' : 'idle'} size={56} />
                <Text style={[styles.sub, { flex: 1 }]}>
                  {making
                    ? `Reading ${plan.total} cards and sorting them into topics…`
                    : `Volt reads all ${plan.total} cards and writes the topics, the must-knows, and what people mix up.`}
                </Text>
              </View>
              <PrimaryButton
                label={making ? 'Writing…' : 'Write my study guide'}
                variant="solid"
                onPress={makeGuide}
                style={{ marginTop: space(4) }}
              />
            </>
          ) : (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.overview}>{guide.overview}</Text>
              {guide.topics.map((t, i) => (
                <View key={i} style={styles.topic}>
                  <Text style={styles.topicTitle}>{t.title}</Text>
                  <Text style={styles.topicBody}>{t.summary}</Text>
                  {t.mustKnow.map((m, j) => (
                    <Text key={j} style={styles.must}>
                      ✓ {m}
                    </Text>
                  ))}
                </View>
              ))}
              {guide.confusions?.length ? (
                <View style={styles.topic}>
                  <Text style={[styles.topicTitle, { color: colors.hard }]}>Easy to mix up</Text>
                  {guide.confusions.map((c, j) => (
                    <Text key={j} style={styles.topicBody}>
                      • {c}
                    </Text>
                  ))}
                </View>
              ) : null}
              {guide.lastNight ? (
                <View style={styles.topic}>
                  <Text style={[styles.topicTitle, { color: colors.accent }]}>The night before</Text>
                  <Text style={styles.topicBody}>{guide.lastNight}</Text>
                </View>
              ) : null}
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton
          label={
            !plan.total
              ? 'Link decks'
              : plan.due
                ? `Study ${plan.due} due`
                : plan.days === 0
                  ? 'Blitz everything'
                  : `Study ${plan.mode.label.toLowerCase()}`
          }
          onPress={() => (plan.total ? onStudy(exam, plan.mode.key) : onEdit(exam))}
        />
      </View>
    </View>
  );
}

function Stat({ n, label, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, tone && { color: tone }]}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(6) },
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  edit: { ...type.body, fontWeight: '700', color: colors.accent },
  body: { paddingHorizontal: space(6), paddingTop: space(3) },
  title: { ...type.title, fontSize: 28, color: colors.text },
  when: { ...type.mono, marginTop: space(2) },
  track: { height: 4, backgroundColor: colors.line, borderRadius: 2, marginTop: space(5), overflow: 'hidden' },
  fill: { height: 4 },
  stats: { flexDirection: 'row', marginTop: space(4), gap: space(6) },
  stat: {},
  statN: { ...type.title, fontSize: 22, color: colors.text },
  statLabel: { ...type.mono, color: colors.textFaint, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(5),
    marginTop: space(4),
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { ...type.mono, color: colors.textFaint },
  today: { ...type.body, fontSize: 18, fontWeight: '700', color: colors.text, marginTop: space(2) },
  sub: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(2) },
  weak: { ...type.body, fontSize: 14, color: colors.text, marginTop: space(2) },
  headActions: { flexDirection: 'row', gap: space(4) },
  redo: { ...type.body, fontSize: 13, fontWeight: '700', color: colors.accent },
  talkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: space(5),
    marginTop: space(4),
  },
  talkTitle: { ...type.body, fontSize: 16, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 22, color: colors.textFaint },
  guideEmpty: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(3) },
  overview: { ...type.body, fontSize: 16, color: colors.text, marginTop: space(3), lineHeight: 24 },
  topic: { marginTop: space(5), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  topicTitle: { ...type.body, fontSize: 16, fontWeight: '800', color: colors.text },
  topicBody: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(2), lineHeight: 21 },
  must: { ...type.body, fontSize: 14, color: colors.text, marginTop: space(2) },
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
