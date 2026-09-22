import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { groupByDay } from '../lib/notes';
import NoteImage from './NoteImage';
import PhotoViewer from './PhotoViewer';
import { colors, radius, space, type } from '../theme';

// The feed: days, newest first, each a kicker line and its entries. An
// entry is a time, its photos, and what was written - the photos carry
// the entry, the text sits under them. Editorial, not a social feed: no
// avatars, no counters, wide margins, one type scale.
//
//   notes      the notes to show (already filtered by the caller)
//   onOpen     tap an entry
//   selecting  strip mode: taps toggle selection instead of opening
//   selected   Set of note ids
//   header     optional element above the first day
//   empty      optional element when there are no notes

export default function NoteFeed({ notes, onOpen, onLongPress, selecting = false, selected, header, empty, contentContainerStyle }) {
  const days = groupByDay(notes);
  // Tap a photo: the viewer, not the editor. { images, index } | null.
  const [viewing, setViewing] = useState(null);
  return (
    <>
    <PhotoViewer images={viewing?.images || []} index={viewing?.index || 0} visible={!!viewing} onClose={() => setViewing(null)} />
    <FlatList
      data={days}
      keyExtractor={(g) => g.day}
      ListHeaderComponent={header || null}
      ListEmptyComponent={empty || null}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: g, index }) => (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(280)}>
          <DayHeader day={g.day} place={g.place} />
          {g.notes.map((n) => (
            <NoteEntry
              key={n.id}
              note={n}
              onPress={() => onOpen?.(n)}
              onLongPress={() => onLongPress?.(n)}
              selecting={selecting}
              selected={selected?.has(n.id)}
              onPhoto={selecting ? null : (i) => setViewing({ images: n.images, index: i })}
            />
          ))}
        </Animated.View>
      )}
    />
    </>
  );
}

// "SEP 18 · GRAND YOHO"
export function DayHeader({ day, place }) {
  return (
    <View style={styles.dayHead}>
      <Text style={styles.dayText}>
        {dayLabel(day)}
        {place ? `  ·  ${place.toUpperCase()}` : ''}
      </Text>
      <View style={styles.dayRule} />
    </View>
  );
}

// The entry: a narrow gutter with the time, then the note. Photos sit in
// a row at a fixed height - one at its own shape, several side by side
// and scrolling if they run past the edge - so a day of twelve photos
// reads as a strip, not a wall. Words under the photos.
export function NoteEntry({ note, onPress, onLongPress, selecting, selected, onPhoto }) {
  const images = note.images || [];
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.entry, selecting && selected && styles.entrySelected]}>
      <View style={styles.gutter}>
        <Text style={styles.time}>{timeLabel(note.at)}</Text>
        {selecting ? (
          <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Text style={styles.checkMark}>✓</Text> : null}</View>
        ) : null}
      </View>
      <View style={styles.entryBody}>
        {images.length ? <Photos images={images} onPress={onPhoto} onLongPress={onLongPress} scroll /> : null}
        {note.title ? <Text style={styles.title}>{note.title}</Text> : null}
        {note.text ? (
          <Text style={styles.text} numberOfLines={images.length ? 5 : 10}>
            {note.text}
          </Text>
        ) : null}
        {note.audio ? (
          <View style={styles.audio}>
            <Text style={styles.audioGlyph}>▶</Text>
            <Text style={styles.audioText}>{fmt(note.audio.duration)} recording</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Photos in a row at a fixed height, each at its own aspect. One photo
// gets a little more height. `scroll` lets a long row run off the edge
// and scroll (the feed); without it the row wraps (the strip, which is
// captured as a still).
//   onPress(index) makes each photo a tap target; a long-press falls
//   through to the entry (selection).
export const PHOTO_H = 132;
export const SINGLE_H = 168;

export function Photos({ images, onPress, onLongPress, scroll = false, gap = space(1.5), radiusSize = radius.md }) {
  const n = images.length;
  const tap = { onPress, onLongPress };
  const h = n === 1 ? SINGLE_H : PHOTO_H;
  const tiles = images.map((img, i) => {
    const ratio = img.width && img.height ? Math.min(Math.max(img.width / img.height, 0.6), 2.2) : 4 / 3;
    return (
      <Tap {...tap} key={img.file || img.uri || i} i={i} style={[styles.tile, { height: h, width: Math.round(h * ratio), borderRadius: radiusSize }]}>
        <NoteImage image={img} style={styles.fill} />
      </Tap>
    );
  });
  if (n === 1) return <View style={styles.rowWrap}>{tiles}</View>;
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap, paddingRight: space(6) }} style={styles.rowScroll}>
        {tiles}
      </ScrollView>
    );
  }
  return <View style={[styles.rowWrap, { gap }]}>{tiles}</View>;
}


// A photo that can be tapped (the viewer) and long-pressed (selection), or
// just a photo. Module-level so React keeps the image mounted across renders.
function Tap({ onPress, onLongPress, i, style, children }) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable onPress={() => onPress(i)} onLongPress={onLongPress} delayLongPress={350} style={style}>
      {children}
    </Pressable>
  );
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// "SEP 18", with the year only when it is not this one.
export function dayLabel(day) {
  const [y, m, d] = day.split('-').map(Number);
  const thisYear = new Date().getFullYear();
  return `${MONTHS[m - 1]} ${d}${y !== thisYear ? ` ${y}` : ''}`;
}

export function timeLabel(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  dayHead: { paddingHorizontal: space(6), paddingTop: space(6), paddingBottom: space(2) },
  dayText: { ...type.mono, color: colors.textDim },
  dayRule: { height: 1, backgroundColor: colors.line, marginTop: space(2) },
  entry: { flexDirection: 'row', paddingLeft: space(5), paddingRight: space(6), paddingVertical: space(3) },
  entrySelected: { backgroundColor: colors.accent + '14' },
  gutter: { width: 62, paddingTop: 2, gap: space(2) },
  entryBody: { flex: 1, gap: space(2), minWidth: 0 },
  time: { ...type.mono, fontSize: 10, color: colors.textFaint },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { ...type.label, fontSize: 12, color: colors.accentInk },
  title: { ...type.body, fontSize: 16, fontWeight: '700', color: colors.text, marginTop: space(1) },
  text: { ...type.body, fontSize: 14, lineHeight: 21, color: colors.textDim },
  rowScroll: { marginRight: -space(6) },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { backgroundColor: colors.surface, overflow: 'hidden', maxWidth: '100%' },
  fill: { width: '100%', height: '100%' },
  audio: { flexDirection: 'row', alignItems: 'center', gap: space(2), alignSelf: 'flex-start', paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  audioGlyph: { fontSize: 10, color: colors.accent },
  audioText: { ...type.mono, fontSize: 10, color: colors.textDim },
});
