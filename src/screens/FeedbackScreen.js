import React, { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { AREAS, feedbackMeta, sendFeedback } from '../lib/feedback';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// One question, one box. The area chips are there to make the first tap
// easy, not to categorise - the message is what matters.
export default function FeedbackScreen({ onClose, tier, deckCount }) {
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState(null);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const send = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      const r = await sendFeedback({
        message: message.trim(),
        area: area ?? 'other',
        contact: contact.trim(),
        meta: feedbackMeta({ tier, decks: deckCount }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(r.via);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert("Didn't go through", e.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.thanks}>
          <Animated.View entering={ZoomIn.springify().damping(14).delay(100)}>
            <Mascot mood="happy" size={96} />
          </Animated.View>
          <Text style={styles.thanksTitle}>Volt read it.</Text>
          <Text style={styles.thanksBody}>
            {sent === 'email'
              ? 'It opened in your mail app - hit send there and it reaches us.'
              : 'Every one of these gets read. The good ones get built.'}
          </Text>
          <PrimaryButton label="Done" onPress={onClose} style={{ marginTop: space(8) }} />
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + space(2) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>What should Cram do next?</Text>
        <Text style={styles.sub}>
          What's missing, what's annoying, what you'd show a friend. Blunt is fine.
        </Text>

        <View style={styles.chips}>
          {AREAS.map((a) => {
            const active = a.key === area;
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setArea(active ? null : a.key);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          multiline
          autoFocus
          placeholder="I wish it could…"
          placeholderTextColor={colors.textFaint}
        />

        <TextInput
          style={styles.contact}
          value={contact}
          onChangeText={setContact}
          placeholder="Email or @handle, if you want a reply (optional)"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton
          label={busy ? 'Sending…' : 'Send'}
          variant={message.trim() ? 'accent' : 'solid'}
          onPress={send}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', paddingHorizontal: space(6) },
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  body: { paddingHorizontal: space(6), paddingTop: space(3), paddingBottom: space(6) },
  title: { ...type.title, fontSize: 26, color: colors.text },
  sub: { ...type.body, color: colors.textDim, marginTop: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(6) },
  chip: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...type.label, fontSize: 12, color: colors.textDim },
  chipTextActive: { color: colors.accentInk },
  input: {
    ...type.body,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.lg,
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    minHeight: 160,
    textAlignVertical: 'top',
    marginTop: space(5),
  },
  contact: {
    ...type.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    marginTop: space(3),
  },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  thanks: { alignItems: 'center', paddingHorizontal: space(10) },
  thanksTitle: { ...type.title, color: colors.text, marginTop: space(6) },
  thanksBody: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(3) },
});
