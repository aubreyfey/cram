import React, { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { exportBackup, pickDeckFile } from '../lib/backup';
import { restore } from '../lib/entitlements';
import { REMINDER_TIMES, getReminder, sendTestAlarm, setReminder } from '../lib/reminders';
import { colors, radius, space, type } from '../theme';
import { alert } from '../lib/alert';

const SITE = Constants.expoConfig?.extra?.siteUrl ?? '';
const VERSION = Constants.expoConfig?.version ?? '';

// The one screen that is allowed to be boring. Everything here is something
// a person does once - turn on the reminder, back up, restore a purchase.
export default function SettingsScreen({ onClose, onImport, onFeedback, tier, deckCount }) {
  const insets = useSafeAreaInsets();
  const [reminder, setRem] = useState({ enabled: false, hour: 20, minute: 0, nag: true });
  const [testArmed, setTestArmed] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    getReminder().then(setRem);
  }, []);

  const applyReminder = async (next) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await setReminder(next);
    setRem(result);
    if (result.unsupported) {
      alert('Not on the web', 'Reminders work in the iPhone and Android app.');
    } else if (result.denied) {
      alert(
        'Notifications are off',
        'Turn them on for Cram in Settings to get a daily nudge.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const testAlarm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const r = await sendTestAlarm();
    if (r.unsupported) return alert('Not on the web', 'The alarm works in the iPhone and Android app.');
    if (r.denied) return alert('Notifications are off', 'Turn them on for Cram in Settings first.');
    setTestArmed(true);
    setTimeout(() => setTestArmed(false), 35000);
  };

  const doExport = async () => {
    setBusy('export');
    try {
      const n = await exportBackup();
      if (Platform.OS === 'web') alert('Downloaded', `${n} decks saved to a file.`);
    } catch (e) {
      alert("Couldn't export", e.message);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const decks = await pickDeckFile();
      if (decks) {
        const n = await onImport(decks);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert('Imported', `${n} ${n === 1 ? 'deck' : 'decks'} added.`);
      }
    } catch (e) {
      alert("Couldn't import", e.message);
    } finally {
      setBusy(null);
    }
  };

  const timeLabel = REMINDER_TIMES.find((t) => t.hour === reminder.hour)?.label ?? `${reminder.hour}:00`;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(10) }]}>
        <Section title="DAILY REMINDER">
          <Row
            label="Remind me to study"
            sub={reminder.enabled ? `Every day at ${timeLabel}` : 'Off'}
            right={
              <Switch
                value={reminder.enabled}
                onValueChange={(v) => applyReminder({ ...reminder, enabled: v })}
                trackColor={{ true: colors.accent, false: colors.line }}
                thumbColor={Platform.OS === 'android' ? colors.text : undefined}
              />
            }
          />
          <View style={styles.chips}>
            {REMINDER_TIMES.map((t) => {
              const active = t.hour === reminder.hour && t.minute === reminder.minute;
              return (
                <Pressable
                  key={t.label}
                  onPress={() => applyReminder({ enabled: true, hour: t.hour, minute: t.minute })}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Row
            label="Nag me if I ignore it"
            sub={reminder.nag ? 'Five minutes later, louder. Volt does not let it go.' : 'Just the one reminder'}
            right={
              <Switch
                value={reminder.nag}
                onValueChange={(v) => applyReminder({ ...reminder, nag: v })}
                trackColor={{ true: colors.accent, false: colors.line }}
                thumbColor={Platform.OS === 'android' ? colors.text : undefined}
              />
            }
          />
          <Row
            label={testArmed ? 'Coming in 30 seconds - lock your phone' : 'Send me a test alarm'}
            sub="Hear the loud one now instead of waiting until tomorrow"
            onPress={testArmed ? null : testAlarm}
          />
        </Section>

        <Section title="BACKUP">
          <Row
            label={busy === 'export' ? 'Exporting…' : 'Export all decks'}
            sub={`${deckCount} ${deckCount === 1 ? 'deck' : 'decks'} to a file you can keep anywhere`}
            onPress={busy ? null : doExport}
          />
          <Row
            label={busy === 'import' ? 'Importing…' : 'Import a backup or deck file'}
            sub="Restores what's missing; never rolls your progress back"
            onPress={busy ? null : doImport}
          />
        </Section>

        <Section title="PLAN">
          <Row
            label={tier === 'admin' ? 'Admin' : tier === 'pro' ? 'Pro' : 'Free'}
            sub={
              tier === 'admin'
                ? 'Unlimited, for testing'
                : tier === 'pro'
                  ? 'Unlimited cards and PDFs'
                  : '10 cards a day from scans. Writing and pasting is always free.'
            }
          />
          <Row
            label="Restore purchases"
            onPress={() => restore().catch((e) => alert('Restore', e.message))}
          />
        </Section>

        <Section title="HELP US">
          <Row
            label="Feedback, roadmap and updates"
            sub="Suggest things, upvote what you want, see what's coming"
            onPress={onFeedback}
          />
        </Section>

        <Section title="ABOUT">
          <Row label="Terms of Use" onPress={() => Linking.openURL(`${SITE}/terms.html`)} />
          <Row label="Privacy Policy" onPress={() => Linking.openURL(`${SITE}/privacy.html`)} />
          <Row label="Version" right={<Text style={styles.version}>{VERSION}</Text>} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function Row({ label, sub, right, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(6),
  },
  title: { ...type.title, color: colors.text },
  close: { ...type.body, fontWeight: '700', color: colors.accent },
  body: { paddingHorizontal: space(6), paddingTop: space(4) },
  section: { marginTop: space(6) },
  sectionTitle: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginLeft: space(1) },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(5),
    paddingVertical: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.surfaceHi },
  rowLabel: { ...type.body, fontWeight: '600', color: colors.text },
  rowSub: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textFaint },
  version: { ...type.mono, color: colors.textFaint },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), padding: space(4), paddingTop: space(3) },
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
});
