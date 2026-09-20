import React, { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { exportBackup, pickDeckFile } from '../lib/backup';
import SignInSheet from '../components/SignInSheet';
import { accountIsLive, getSession, signOut } from '../lib/account';
import { cloudIsLive, getStatus, onStatus, sync } from '../lib/cloud';
import { restore } from '../lib/entitlements';
import { REMINDER_TIMES, getReminder, sendTestAlarm, setReminder } from '../lib/reminders';
import { openStorePage, shareCram, storeIsListed } from '../lib/growth';
import { getProfile, setName } from '../lib/profile';
import { colors, radius, space, type } from '../theme';
import { alert } from '../lib/alert';

const SITE = Constants.expoConfig?.extra?.siteUrl ?? '';
const VERSION = Constants.expoConfig?.version ?? '';

// The one screen that is allowed to be boring. Everything here is something
// a person does once - turn on the reminder, back up, restore a purchase.
export default function SettingsScreen({ onClose, onImport, onFeedback, onNameChange, tier, deckCount }) {
  const insets = useSafeAreaInsets();
  const [reminder, setRem] = useState({ enabled: false, hour: 20, minute: 0, nag: true });
  const [testArmed, setTestArmed] = useState(false);
  const [name, setNameState] = useState('');
  const [busy, setBusy] = useState(null);
  const [session, setSession] = useState(null);
  const [cloud, setCloud] = useState(getStatus());
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    getReminder().then(setRem);
    getProfile().then((p) => setNameState(p.name));
    if (accountIsLive) getSession().then(setSession);
    return onStatus(setCloud);
  }, []);

  const commitName = async () => {
    const p = await setName(name);
    setNameState(p.name);
    onNameChange?.(p.name);
  };

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

  const leave = () =>
    alert('Sign out?', 'Your decks stay on this phone. They just stop backing up.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setSession(null);
        },
      },
    ]);

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
        <Section title="YOU">
          <View style={styles.nameRow}>
            <Text style={styles.rowLabel}>What should Volt call you?</Text>
            <Text style={styles.rowSub}>Optional. Stays on this phone.</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setNameState}
              onBlur={commitName}
              onSubmitEditing={commitName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={40}
            />
          </View>
        </Section>

        <Section title="DAILY REMINDER">
          <Row
            label="Remind me to study"
            sub={reminder.enabled ? `Every day at ${timeLabel}` : 'Off'}
            right={
              <Switch
                value={reminder.enabled}
                onValueChange={(v) => applyReminder({ ...reminder, enabled: v })}
                trackColor={{ true: colors.accent, false: colors.line }}
                thumbColor={colors.text}
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
                thumbColor={colors.text}
              />
            }
          />
          <Row
            label={testArmed ? 'Coming in 30 seconds - lock your phone' : 'Send me a test alarm'}
            sub="Hear the loud one now instead of waiting until tomorrow"
            onPress={testArmed ? null : testAlarm}
          />
        </Section>

        <Section title="ACCOUNT">
          {!accountIsLive ? <Row label="Cloud backup" sub="Not available in this build" /> : null}
          {accountIsLive && session ? <Row label={session.user.email} sub={cloudLine(cloud)} /> : null}
          {accountIsLive && session ? (
            <Row
              label={cloud.syncing ? 'Backing up…' : 'Back up now'}
              sub="Runs on its own after every change; this is for the impatient"
              onPress={cloud.syncing ? null : () => sync()}
            />
          ) : null}
          {accountIsLive && session ? <Row label="Sign out" onPress={leave} /> : null}
          {accountIsLive && !session ? (
            <Row
              label="Sign in to back up"
              sub="Decks, exams and progress saved to your account. Get them back on a new phone."
              onPress={() => setSigningIn(true)}
            />
          ) : null}
        </Section>

        <Section title="BACKUP FILE">
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

        <Section title="SPREAD THE WORD">
          <Row
            label="Share Cram"
            sub="Send it to someone with an exam coming"
            onPress={shareCram}
          />
          <Row
            label="Rate Cram"
            sub={
              storeIsListed()
                ? "Thirty seconds on the App Store. It matters more than you'd think."
                : 'Coming with the App Store listing'
            }
            onPress={async () => {
              if (!(await openStorePage())) alert('Not on the store yet', 'Rating opens once Cram is listed.');
            }}
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
      <SignInSheet
        visible={signingIn}
        onClose={() => setSigningIn(false)}
        onSignedIn={(s) => {
          setSigningIn(false);
          setSession(s);
          sync();
        }}
        sub="No password. We email you a code, you type it, and your decks start backing up."
      />
    </View>
  );
}

// "Backed up just now", "Backed up 3 min ago", or what went wrong.
function cloudLine(c) {
  if (!cloudIsLive) return '';
  if (c.syncing) return 'Backing up…';
  if (c.error) return c.error;
  if (!c.lastSync) return 'Not backed up yet';
  const m = Math.round((Date.now() - c.lastSync) / 60000);
  if (m < 1) return 'Backed up just now';
  if (m < 60) return `Backed up ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Backed up ${h}h ago`;
  return `Backed up ${Math.round(h / 24)}d ago`;
}

function Section({ title, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>
        {items.map((child, i) =>
          React.isValidElement(child) && child.type === Row
            ? React.cloneElement(child, { last: i === items.length - 1 })
            : child,
        )}
      </View>
    </View>
  );
}

function Row({ label, sub, right, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && onPress && styles.rowPressed]}
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
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.surfaceHi },
  nameRow: { paddingHorizontal: space(5), paddingVertical: space(4) },
  nameInput: {
    ...type.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    marginTop: space(3),
  },
  rowLabel: { ...type.body, fontWeight: '600', color: colors.text },
  rowSub: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textFaint },
  version: { ...type.mono, color: colors.textFaint },
  chips: { flexDirection: 'row', gap: space(1.5), paddingHorizontal: space(4), paddingVertical: space(3) },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...type.label, fontSize: 11, letterSpacing: 0.2, color: colors.textDim },
  chipTextActive: { color: colors.accentInk },
});
