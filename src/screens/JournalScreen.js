import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Mascot from '../components/Mascot';
import { journalDays, loadJournal, summarize } from '../lib/journal';
import { colors, radius, space, type } from '../theme';

// The journal: the streak, then the week, then every day that had
// something in it. Numbers, plainly - a student can see at a glance
// whether the week was a real one, and the day-list is the part that
// makes the streak feel earned rather than counted.
export default function JournalScreen({ streak = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const [journal, setJournal] = useState(null);

  useEffect(() => {
    loadJournal().then(setJournal);
  }, []);

  const week = journal ? summarize(journal, 7) : null;
  const days = journal ? journalDays(journal) : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Decks</Text>
        </Pressable>
        <Text style={styles.title}>Journal</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(10) }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
          <Mascot mood={streak > 1 ? 'happy' : 'idle'} size={72} />
          <Text style={styles.streak}>{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</Text>
          <Text style={styles.streakSub}>
            {streak > 1 ? 'Rate one card a day and it keeps going.' : 'Rate one card today and it starts.'}
          </Text>
        </Animated.View>

        {week ? (
          <Animated.View entering={FadeInDown.delay(80).duration(320)} style={styles.card}>
            <Text style={styles.kicker}>THIS WEEK</Text>
            <View style={styles.stats}>
              <Stat n={week.activeDays} label={week.activeDays === 1 ? 'day' : 'days'} />
              <Stat n={week.rated} label="cards" />
              <Stat n={week.accuracy == null ? '–' : `${Math.round(week.accuracy * 100)}%`} label="got it" />
              <Stat n={week.scans} label={week.scans === 1 ? 'scan' : 'scans'} />
            </View>
            {week.talkSeconds ? <Text style={styles.line}>{minutes(week.talkSeconds)} of explaining out loud</Text> : null}
          </Animated.View>
        ) : null}

        {days.length ? <Text style={styles.section}>EVERY DAY</Text> : null}
        {days.map((d, i) => (
          <Animated.View key={d.day} entering={FadeInDown.delay(120 + Math.min(i, 12) * 30).duration(280)} style={styles.day}>
            <Text style={styles.dayName}>{dayLabel(d.day)}</Text>
            <Text style={styles.dayLine}>{describe(d)}</Text>
          </Animated.View>
        ))}
        {journal && !days.length ? (
          <Text style={styles.empty}>Nothing yet. Scan a page or rate a card and today shows up here.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ n, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// "3 scans · 42 cards, 88% got it · 4 min talking"
export function describe(d) {
  const parts = [];
  if (d.scans) parts.push(`${d.scans} ${d.scans === 1 ? 'scan' : 'scans'}${d.cards ? ` (${d.cards} cards)` : ''}`);
  if (d.rated) {
    const pct = d.good ? `, ${Math.round((d.good / d.rated) * 100)}% got it` : '';
    parts.push(`${d.rated} ${d.rated === 1 ? 'card' : 'cards'} rated${pct}`);
  }
  if (d.talks) parts.push(`${minutes(d.talkSeconds || 0)} talking`);
  return parts.join(' · ');
}

function minutes(s) {
  const m = Math.round(s / 60);
  return m < 1 ? 'under a minute' : `${m} min`;
}

// "Today", "Yesterday", then "Tue 15 Sep".
export function dayLabel(day, ref = new Date()) {
  const t = new Date(day + 'T00:00:00');
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = Math.round((today - t) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
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
  title: { ...type.body, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: space(6), paddingTop: space(4) },
  hero: { alignItems: 'center', marginBottom: space(6), gap: space(1) },
  streak: { ...type.title, color: colors.text, marginTop: space(2) },
  streakSub: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(5),
    marginBottom: space(6),
  },
  kicker: { ...type.mono, color: colors.textFaint, marginBottom: space(3) },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statN: { ...type.title, fontSize: 24, color: colors.text },
  statLabel: { ...type.mono, fontSize: 10, color: colors.textFaint, marginTop: 2 },
  line: { ...type.body, fontSize: 13, color: colors.textDim, textAlign: 'center', marginTop: space(4) },
  section: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginLeft: space(1) },
  day: {
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dayName: { ...type.body, fontWeight: '700', color: colors.text },
  dayLine: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: 2 },
  empty: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(6) },
});
