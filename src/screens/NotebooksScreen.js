import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import NoteFeed from '../components/NoteFeed';
import NoteImage from '../components/NoteImage';
import { countByNotebook, searchNotes } from '../lib/notes';
import { useLayout } from '../lib/layout';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// Notebooks: the shelf. Books, not folders - a cover, a name, how many
// notes. The other tab is the timeline: every note from every notebook,
// by day, for when you remember *when* but not *where*. Search spans both.
const TABS = [
  { key: 'books', label: 'Notebooks' },
  { key: 'timeline', label: 'Timeline' },
];

export default function NotebooksScreen({
  notebooks,
  notes,
  onOpenNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onCoverNotebook,
  onArchiveNotebook,
  onDeleteNotebook,
  onOpenNote,
  onNewNote,
  onStrip,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const [tab, setTab] = useState('books');
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const counts = useMemo(() => countByNotebook(notes), [notes]);
  const live = notebooks.filter((b) => !b.archived);
  const archived = notebooks.filter((b) => b.archived);
  const found = useMemo(() => (searching ? searchNotes(notes, notebooks, query) : notes), [notes, notebooks, query, searching]);

  // Strip mode on the timeline: long-press an entry to start, tap to add.
  const [picking, setPicking] = useState(null); // Set of ids | null

  const bookActions = (b) =>
    alert(b.title, `${counts[b.id] || 0} ${counts[b.id] === 1 ? 'note' : 'notes'}`, [
      { text: 'Rename', onPress: () => onRenameNotebook(b) },
      { text: 'Change cover', onPress: () => onCoverNotebook(b) },
      { text: b.archived ? 'Unarchive' : 'Archive', onPress: () => onArchiveNotebook(b) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          alert('Delete notebook?', `"${b.title}" and every note in it will be gone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDeleteNotebook(b) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const columns = wide ? 3 : 2;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Decks</Text>
        </Pressable>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]} hitSlop={6}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => onNewNote(null)} hitSlop={16}>
          <Text style={styles.newLink}>New</Text>
        </Pressable>
      </View>

      {notes.length >= 4 ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes and notebooks"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      ) : null}

      {tab === 'timeline' || searching ? (
        <>
          <NoteFeed
            notes={found}
            onOpen={(n) => (picking ? toggle(n) : onOpenNote(n))}
            onLongPress={(n) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPicking(new Set([n.id]));
            }}
            selecting={!!picking}
            selected={picking}
            contentContainerStyle={{ paddingBottom: insets.bottom + space(28) }}
            empty={
              <View style={styles.empty}>
                <Mascot mood="idle" size={72} />
                <Text style={styles.emptyTitle}>{searching ? `Nothing matches “${query.trim()}”` : 'Nothing here yet'}</Text>
                {!searching ? <Text style={styles.emptyBody}>A photo of the board, a diagram, what you understood - by day, in your own words.</Text> : null}
              </View>
            }
          />
          {picking ? (
            <View style={[styles.pickBar, { paddingBottom: insets.bottom + space(3) }]}>
              <Pressable onPress={() => setPicking(null)} hitSlop={12}>
                <Text style={styles.pickCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.pickCount}>
                {picking.size} {picking.size === 1 ? 'note' : 'notes'}
              </Text>
              <Pressable onPress={() => picking.size && onStrip(found.filter((n) => picking.has(n.id)))} hitSlop={12}>
                <Text style={[styles.pickGo, !picking.size && { color: colors.textFaint }]}>Make a strip</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <ScrollView contentContainerStyle={[styles.shelf, { paddingBottom: insets.bottom + space(10) }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Your notebooks</Text>
          <View style={styles.grid}>
            {live.map((b, i) => (
              <Book key={b.id} book={b} count={counts[b.id] || 0} columns={columns} index={i} onPress={() => onOpenNotebook(b)} onLongPress={() => bookActions(b)} />
            ))}
            <Animated.View entering={FadeInDown.delay(live.length * 40).duration(280)} style={[styles.cell, { width: `${100 / columns}%` }]}>
              <Pressable onPress={onCreateNotebook} style={[styles.book, styles.bookNew]}>
                <Text style={styles.plus}>+</Text>
                <Text style={styles.plusText}>New notebook</Text>
              </Pressable>
            </Animated.View>
          </View>
          {archived.length ? (
            <>
              <Text style={styles.section}>ARCHIVED</Text>
              <View style={styles.grid}>
                {archived.map((b, i) => (
                  <Book key={b.id} book={b} count={counts[b.id] || 0} columns={columns} index={i} dim onPress={() => onOpenNotebook(b)} onLongPress={() => bookActions(b)} />
                ))}
              </View>
            </>
          ) : null}
          {!live.length && !archived.length ? (
            <View style={styles.empty}>
              <Mascot mood="idle" size={72} />
              <Text style={styles.emptyTitle}>One per subject</Text>
              <Text style={styles.emptyBody}>Photos of the board, diagrams, what you understood in your own words, you explaining it out loud. Cards test you; this is where it lives.</Text>
              <PrimaryButton label="New notebook" onPress={onCreateNotebook} style={{ marginTop: space(6), alignSelf: 'stretch' }} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );

  function toggle(n) {
    const next = new Set(picking);
    if (next.has(n.id)) next.delete(n.id);
    else next.add(n.id);
    setPicking(next);
  }
}

// A book on the shelf: cover (or a colour and an initial), name, count.
export function Book({ book, count, columns, index = 0, dim = false, onPress, onLongPress }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(280)} style={[styles.cell, { width: `${100 / columns}%` }]}>
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.book, dim && { opacity: 0.55 }]}>
        <View style={styles.cover}>
          {book.cover ? (
            <NoteImage image={book.cover} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.coverBlank, { backgroundColor: tint(book.id) }]}>
              <Text style={styles.initial}>{(book.title || '?').trim()[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.spine} />
        </View>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookCount}>
          {count} {count === 1 ? 'note' : 'notes'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// A stable colour per notebook, from the palette, so blank covers are not
// all the same grey.
const TINTS = [colors.violet, '#2F6B5A', '#7A4B2F', '#3B4F8A', '#6B2F5A', '#2F5A7A'];
function tint(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(6), paddingBottom: space(3) },
  close: { ...type.body, fontWeight: '700', color: colors.accent, width: 56 },
  newLink: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56, textAlign: 'right' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.line },
  tab: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.surfaceHi },
  tabText: { ...type.label, fontSize: 12, color: colors.textDim },
  tabTextOn: { color: colors.text },
  search: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    marginHorizontal: space(6),
    marginBottom: space(2),
  },
  shelf: { paddingHorizontal: space(4), paddingTop: space(2) },
  title: { ...type.title, fontSize: 26, color: colors.text, marginHorizontal: space(2), marginBottom: space(4) },
  section: { ...type.mono, color: colors.textFaint, marginHorizontal: space(2), marginTop: space(6), marginBottom: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: space(2) },
  book: { gap: space(2) },
  bookNew: { alignItems: 'center', justifyContent: 'center', aspectRatio: 3 / 4, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
  plus: { fontSize: 36, color: colors.textDim, lineHeight: 40 },
  plusText: { ...type.label, fontSize: 12, color: colors.textDim },
  cover: { aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  coverBlank: { alignItems: 'center', justifyContent: 'center' },
  initial: { ...type.hero, color: '#FFFFFFCC' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: '#00000055' },
  bookTitle: { ...type.body, fontWeight: '700', color: colors.text, marginTop: space(1) },
  bookCount: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: -space(1) },
  empty: { alignItems: 'center', paddingTop: space(12), paddingHorizontal: space(8), gap: space(2) },
  emptyTitle: { ...type.title, fontSize: 22, color: colors.text, textAlign: 'center', marginTop: space(3) },
  emptyBody: { ...type.body, color: colors.textDim, textAlign: 'center' },
  pickBar: {
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
  pickCancel: { ...type.body, fontWeight: '600', color: colors.textDim },
  pickCount: { ...type.mono, color: colors.textDim },
  pickGo: { ...type.body, fontWeight: '700', color: colors.accent },
});
