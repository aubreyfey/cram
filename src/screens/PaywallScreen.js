import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PrimaryButton from '../components/PrimaryButton';
import Constants from 'expo-constants';
import { PLANS, purchase, restore } from '../lib/entitlements';
import { colors, radius, space, type } from '../theme';
import { alert } from '../lib/alert';

// Apple rejects subscription apps whose legal links 404. These pages live in
// public/ and ship with the web build, so they exist wherever that deploys.
const SITE = Constants.expoConfig?.extra?.siteUrl ?? '';

const BENEFITS = [
  'Unlimited cards, every day',
  'Turn whole PDFs into decks',
  'Every deck saved and scheduled',
  'Cancel any time',
];

const HEADLINES = {
  quota: {
    title: "You're out of free cards",
    sub: 'Free resets tomorrow. Or keep going now.',
  },
  documents: {
    title: 'Whole PDFs, one tap',
    sub: 'Drop in a lecture deck or a chapter and get every card at once.',
  },
  explain: {
    title: 'Ask why, every card',
    sub: "Three explanations a day are free. Pro doesn't count.",
  },
  default: {
    title: 'Study without limits',
    sub: 'Turn any page into a deck, as many as you need.',
  },
};

export default function PaywallScreen({ onClose, onPurchased, reason }) {
  const [selected, setSelected] = useState('cram_semester');
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const buy = async () => {
    setBusy(true);
    try {
      await purchase(selected);
      onPurchased();
    } catch (e) {
      alert('Not available yet', e.message);
    } finally {
      setBusy(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selected);
  const copy = HEADLINES[reason] ?? HEADLINES.default;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <Pressable onPress={onClose} hitSlop={16} style={styles.closeWrap}>
        <Text style={styles.close}>Not now</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>{copy.title}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b, i) => (
            <Animated.View
              key={b}
              entering={FadeInDown.delay(80 + i * 60).duration(320)}
              style={styles.benefitRow}
            >
              <Text style={styles.check}>✓</Text>
              <Text style={styles.benefitText}>{b}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.plans}>
          {PLANS.map((p) => {
            const active = p.id === selected;
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelected(p.id)}
                style={[styles.plan, active && styles.planActive]}
              >
                {p.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{p.badge}</Text>
                  </View>
                ) : null}
                <View style={styles.planLeft}>
                  <Text style={[styles.planLabel, active && { color: colors.text }]}>
                    {p.label}
                  </Text>
                  <Text style={styles.planNote}>{p.note}</Text>
                </View>
                <View style={styles.planRight}>
                  <Text style={[styles.planPrice, active && { color: colors.accent }]}>
                    {p.price}
                  </Text>
                  <Text style={styles.planPeriod}>{p.period}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton
          label={busy ? 'One moment…' : plan?.trial ? 'Start my free week' : 'Continue'}
          onPress={buy}
        />
        <View style={styles.legalRow}>
          <Pressable onPress={() => restore().catch((e) => alert('Restore', e.message))}>
            <Text style={styles.legal}>Restore</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`${SITE}/terms.html`)}>
            <Text style={styles.legal}>Terms</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`${SITE}/privacy.html`)}>
            <Text style={styles.legal}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  closeWrap: { alignSelf: 'flex-end', paddingHorizontal: space(6), paddingVertical: space(2) },
  close: { ...type.body, color: colors.textDim, fontWeight: '600' },
  scroll: { paddingHorizontal: space(6), paddingBottom: space(6) },
  headline: { ...type.hero, fontSize: 34, color: colors.text, marginTop: space(4) },
  sub: { ...type.body, color: colors.textDim, marginTop: space(3) },
  benefits: { marginTop: space(8), gap: space(3) },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  check: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  benefitText: { ...type.body, color: colors.text },
  plans: { marginTop: space(9), gap: space(3) },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space(5),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  planActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  planLeft: { flex: 1 },
  planRight: { alignItems: 'flex-end' },
  planLabel: { ...type.body, fontSize: 17, fontWeight: '700', color: colors.textDim },
  planNote: { ...type.body, fontSize: 13, color: colors.textFaint, marginTop: 2 },
  planPrice: { ...type.body, fontSize: 19, fontWeight: '800', color: colors.textDim },
  planPeriod: { ...type.mono, color: colors.textFaint, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -9,
    left: space(5),
    backgroundColor: colors.accent,
    paddingHorizontal: space(2),
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { ...type.mono, fontSize: 10, color: colors.accentInk },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: space(6), marginTop: space(4) },
  legal: { ...type.body, fontSize: 13, color: colors.textFaint },
});
