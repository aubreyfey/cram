import React, { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { fileUri, groupByDay } from '../lib/notes';
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
  return (
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
            />
          ))}
        </Animated.View>
      )}
    />
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

export function NoteEntry({ note, onPress, onLongPress, selecting, selected }) {
  const images = note.images || [];
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.entry, selecting && selected && styles.entrySelected]}>
      <View style={styles.entryHead}>
        <Text style={styles.time}>{timeLabel(note.at)}</Text>
        {selecting ? (
          <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Text style={styles.checkMark}>✓</Text> : null}</View>
        ) : null}
      </View>
      {images.length ? <Photos images={images} /> : null}
      {note.title ? <Text style={styles.title}>{note.title}</Text> : null}
      {note.text ? (
        <Text style={styles.text} numberOfLines={images.length ? 6 : 12}>
          {note.text}
        </Text>
      ) : null}
      {note.audio ? (
        <View style={styles.audio}>
          <Text style={styles.audioGlyph}>▶</Text>
          <Text style={styles.audioText}>{fmt(note.audio.duration)} recording</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// One photo: full width at its own shape (capped tall). Two: side by side.
// Three: a row. Four or more: a 2x2 with "+N" on the last.
export function Photos({ images, gap = space(1.5), radiusSize = radius.md }) {
  const n = images.length;
  if (n === 1) {
    const img = images[0];
    const ratio = img.width && img.height ? Math.max(img.width / img.height, 0.8) : 4 / 3;
    return <NoteImage image={img} style={[styles.photo, { aspectRatio: ratio, borderRadius: radiusSize }]} />;
  }
  if (n === 2 || n === 3) {
    return (
      <View style={[styles.row, { gap }]}>
        {images.map((img, i) => (
          <NoteImage key={img.file || img.uri || i} image={img} style={[styles.photo, styles.square, { borderRadius: radiusSize }]} />
        ))}
      </View>
    );
  }
  const four = images.slice(0, 4);
  return (
    <View style={{ gap }}>
      {[four.slice(0, 2), four.slice(2, 4)].map((pair, r) => (
        <View key={r} style={[styles.row, { gap }]}>
          {pair.map((img, i) => {
            const last = r === 1 && i === 1 && n > 4;
            return (
              <View key={img.file || img.uri || i} style={styles.photo}>
                <NoteImage image={img} style={[styles.square, { borderRadius: radiusSize }]} />
                {last ? (
                  <View style={[styles.more, { borderRadius: radiusSize }]}>
                    <Text style={styles.moreText}>+{n - 4}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// A stored image, or nothing if it is not on this phone.
export function NoteImage({ image, style, resizeMode = 'cover' }) {
  const [broken, setBroken] = useState(false);
  const uri = fileUri(image);
  if (!uri || broken) return <View style={[style, styles.missing]} />;
  return <Image source={{ uri }} resizeMode={resizeMode} onError={() => setBroken(true)} style={style} />;
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
  entry: { paddingHorizontal: space(6), paddingVertical: space(4), gap: space(3) },
  entrySelected: { backgroundColor: colors.accent + '14' },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { ...type.mono, fontSize: 11, color: colors.textFaint },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { ...type.label, fontSize: 12, color: colors.accentInk },
  title: { ...type.body, fontSize: 18, fontWeight: '700', color: colors.text },
  text: { ...type.body, color: colors.textDim },
  row: { flexDirection: 'row' },
  photo: { flex: 1, width: '100%', backgroundColor: colors.surface, overflow: 'hidden' },
  square: { width: '100%', aspectRatio: 1 },
  missing: { backgroundColor: colors.surface },
  more: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000AA', alignItems: 'center', justifyContent: 'center' },
  moreText: { ...type.title, fontSize: 22, color: colors.text },
  audio: { flexDirection: 'row', alignItems: 'center', gap: space(2), alignSelf: 'flex-start', paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  audioGlyph: { fontSize: 10, color: colors.accent },
  audioText: { ...type.mono, fontSize: 10, color: colors.textDim },
});
