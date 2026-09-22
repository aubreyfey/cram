import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import NoteFeed, { NoteImage } from '../components/NoteFeed';
import { colors, radius, space, type } from '../theme';

// One notebook, open. The cover across the top, then its notes by day.
// New notes land here. Long-press an entry to start picking for a strip.
export default function NotebookScreen({ notebook, notes, onOpenNote, onNewNote, onEdit, onStrip, onClose }) {
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(null);

  const toggle = (n) => {
    const next = new Set(picking);
    if (next.has(n.id)) next.delete(n.id);
    else next.add(n.id);
    setPicking(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Notebooks</Text>
        </Pressable>
        <Text style={styles.headTitle} numberOfLines={1}>
          {notebook.title}
        </Text>
        <Pressable onPress={() => onEdit(notebook)} hitSlop={16}>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      </View>

      <NoteFeed
        notes={notes}
        onOpen={(n) => (picking ? toggle(n) : onOpenNote(n))}
        onLongPress={(n) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setPicking(new Set([n.id]));
        }}
        selecting={!!picking}
        selected={picking}
        contentContainerStyle={{ paddingBottom: insets.bottom + space(28) }}
        header={
          <View style={styles.hero}>
            <View style={styles.cover}>
              {notebook.cover ? (
                <NoteImage image={notebook.cover} style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.coverBlank]}>
                  <Mascot mood="idle" size={56} />
                </View>
              )}
            </View>
            <Text style={styles.title}>{notebook.title}</Text>
            <Text style={styles.meta}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              {notebook.archived ? '  ·  ARCHIVED' : ''}
            </Text>
          </View>
        }
        empty={
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nothing in here yet. A photo of today's board is a good first note.</Text>
          </View>
        }
      />

      {picking ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space(3) }]}>
          <Pressable onPress={() => setPicking(null)} hitSlop={12}>
            <Text style={styles.barCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.barCount}>
            {picking.size} {picking.size === 1 ? 'note' : 'notes'}
          </Text>
          <Pressable onPress={() => picking.size && onStrip(notes.filter((n) => picking.has(n.id)))} hitSlop={12}>
            <Text style={[styles.barGo, !picking.size && { color: colors.textFaint }]}>Make a strip</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.fab, { bottom: insets.bottom + space(6) }]} pointerEvents="box-none">
          <PrimaryButton label="New note" onPress={() => onNewNote(notebook)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(6), paddingBottom: space(2), gap: space(3) },
  close: { ...type.body, fontWeight: '700', color: colors.accent },
  headTitle: { ...type.body, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  edit: { ...type.body, fontWeight: '700', color: colors.textDim },
  hero: { paddingHorizontal: space(6), paddingTop: space(3), alignItems: 'center', gap: space(2) },
  cover: { width: 120, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  coverBlank: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHi },
  title: { ...type.title, color: colors.text, textAlign: 'center', marginTop: space(2) },
  meta: { ...type.mono, color: colors.textFaint },
  empty: { paddingHorizontal: space(8), paddingTop: space(10) },
  emptyBody: { ...type.body, color: colors.textDim, textAlign: 'center' },
  fab: { position: 'absolute', left: space(6), right: space(6) },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingTop: space(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  barCancel: { ...type.body, fontWeight: '600', color: colors.textDim },
  barCount: { ...type.mono, color: colors.textDim },
  barGo: { ...type.body, fontWeight: '700', color: colors.accent },
});
