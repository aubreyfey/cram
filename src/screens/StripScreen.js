import React, { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { Photos, dayLabel, timeLabel } from '../components/NoteFeed';
import { dayOf } from '../lib/notes';
import { useLayout } from '../lib/layout';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// A strip: the notes you picked, stacked into one tall image for a group
// chat or a story. Notebook name on top, each note as it looks in the
// feed, a quiet mark at the bottom. Rendered on screen at phone width and
// captured at 3x, so it is sharp on any phone it lands on.
const STRIP_W = 360;
const OUT_W = 1080;

export default function StripScreen({ notes, notebook, onClose }) {
  const insets = useSafeAreaInsets();
  const { width } = useLayout();
  const stripRef = useRef(null);
  const [busy, setBusy] = useState(null);
  const sorted = [...notes].sort((a, b) => (a.at || 0) - (b.at || 0));
  const days = [...new Set(sorted.map((n) => dayOf(n.at)))];
  const range = days.length === 1 ? dayLabel(days[0]) : `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}`;
  const scale = Math.min(1, (width - space(12)) / STRIP_W);

  const capture = async () => {
    const { captureRef } = await import('react-native-view-shot');
    return await captureRef(stripRef, { format: 'jpg', quality: 0.92, result: 'tmpfile', width: OUT_W, height: undefined });
  };

  const share = async () => {
    if (Platform.OS === 'web') return alert('On the phone', 'Strips are made in the iPhone and Android app.');
    setBusy('share');
    try {
      const uri = await capture();
      const Sharing = await import('expo-sharing');
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: notebook?.title || 'Cram strip' });
    } catch (e) {
      alert("Couldn't share that", e.message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (Platform.OS === 'web') return alert('On the phone', 'Strips are made in the iPhone and Android app.');
    setBusy('save');
    try {
      const Media = await import('expo-media-library');
      const perm = await Media.requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('Allow Cram to add to your photos in Settings.');
      const uri = await capture();
      await Media.Asset.create(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert('Saved', 'The strip is in your photos.');
    } catch (e) {
      alert("Couldn't save that", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Back</Text>
        </Pressable>
        <Text style={styles.headTitle}>Your strip</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.preview, { paddingBottom: space(40) }]} showsVerticalScrollIndicator={false}>
        <View style={{ width: STRIP_W * scale, alignSelf: 'center' }}>
          <View style={{ width: STRIP_W, transform: [{ scale }], transformOrigin: 'top left' }}>
            <View ref={stripRef} collapsable={false} style={styles.strip}>
              <View style={styles.stripHead}>
                <Text style={styles.stripBook}>{(notebook?.title || 'NOTES').toUpperCase()}</Text>
                <Text style={styles.stripRange}>{range}</Text>
              </View>
              {sorted.map((n, i) => (
                <View key={n.id} style={[styles.note, i > 0 && styles.noteRule]}>
                  <Text style={styles.time}>
                    {days.length > 1 ? `${dayLabel(dayOf(n.at))}  ·  ` : ''}
                    {timeLabel(n.at)}
                    {n.place ? `  ·  ${n.place.toUpperCase()}` : ''}
                  </Text>
                  {n.images?.length ? <Photos images={n.images} gap={4} radiusSize={radius.sm} /> : null}
                  {n.title ? <Text style={styles.title}>{n.title}</Text> : null}
                  {n.text ? (
                    <Text style={styles.text} numberOfLines={14}>
                      {n.text}
                    </Text>
                  ) : null}
                </View>
              ))}
              <View style={styles.stripFoot}>
                <Mascot mood="idle" size={28} />
                <Text style={styles.stripMark}>made with Cram</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton label={busy === 'save' ? 'Saving…' : 'Save to device'} variant="solid" onPress={busy ? undefined : save} style={{ flex: 1 }} />
        <PrimaryButton label={busy === 'share' ? 'One moment…' : 'Share'} onPress={busy ? undefined : share} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(6), paddingBottom: space(3) },
  close: { ...type.body, fontWeight: '700', color: colors.accent, width: 56 },
  headTitle: { ...type.body, fontWeight: '700', color: colors.text },
  preview: { paddingTop: space(2) },
  strip: { backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderWidth: 1, borderColor: colors.line },
  stripHead: { marginBottom: 8 },
  stripBook: { ...type.mono, color: colors.accent },
  stripRange: { ...type.title, fontSize: 22, color: colors.text, marginTop: 4 },
  note: { paddingVertical: 14, gap: 8 },
  noteRule: { borderTopWidth: 1, borderTopColor: colors.line },
  time: { ...type.mono, fontSize: 10, color: colors.textDim },
  title: { ...type.body, fontSize: 17, fontWeight: '700', color: colors.text },
  text: { ...type.body, fontSize: 14, lineHeight: 21, color: colors.textDim },
  stripFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, opacity: 0.7 },
  stripMark: { ...type.mono, fontSize: 10, color: colors.textFaint },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(6),
    paddingTop: space(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
