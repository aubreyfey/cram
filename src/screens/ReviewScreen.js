import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import PrimaryButton from '../components/PrimaryButton';
import { MAX_PAGES } from '../lib/api';
import { colors, radius, space, type } from '../theme';

const COLUMNS = 3;

// The pages of a deck before they are sent. Every photo taken or picked lands
// here, so a whole lecture can be shot slide by slide and checked for a
// blurry frame before it costs a request. "Make cards" is the only thing on
// the screen that is bright - the rest is housekeeping.
export default function ReviewScreen({
  pages,
  appendTo,
  onRemove,
  onAddCamera,
  onAddLibrary,
  onGenerate,
  onCancel,
}) {
  const insets = useSafeAreaInsets();
  const full = pages.length >= MAX_PAGES;
  const n = pages.length;

  const remove = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove(index);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={16}>
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
        <Text style={styles.counter}>
          {n} / {MAX_PAGES}
        </Text>
      </View>

      <Text style={styles.title}>
        {n === 1 ? 'One page' : `${n} pages`}
        {appendTo ? <Text style={styles.titleDim}>  →  {appendTo.title}</Text> : null}
      </Text>
      <Text style={styles.sub}>
        {n === 1
          ? 'Add more if this is part of a set, or make the cards now.'
          : 'In order, first to last. Tap a page to take it out.'}
      </Text>

      <FlatList
        data={pages}
        numColumns={COLUMNS}
        keyExtractor={(p, i) => p.uri + i}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.cell}>
            <Pressable onPress={() => remove(index)} style={styles.thumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              <View style={styles.num}>
                <Text style={styles.numText}>{index + 1}</Text>
              </View>
              <View style={styles.x}>
                <Text style={styles.xText}>✕</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
        ListFooterComponent={
          !full ? (
            <Animated.View entering={FadeIn} style={styles.addRow}>
              <Pressable style={styles.add} onPress={onAddCamera}>
                <Text style={styles.addGlyph}>⌖</Text>
                <Text style={styles.addText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.add} onPress={onAddLibrary}>
                <Text style={styles.addGlyph}>▣</Text>
                <Text style={styles.addText}>Photos</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Text style={styles.fullNote}>That's the most for one deck.</Text>
          )
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton
          label={n === 1 ? 'Make cards' : `Make cards from ${n} pages`}
          onPress={onGenerate}
        />
      </View>
    </View>
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
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  counter: { ...type.mono, color: colors.textDim },
  title: { ...type.title, fontSize: 24, color: colors.text, paddingHorizontal: space(6), marginTop: space(3) },
  titleDim: { color: colors.textDim, fontSize: 18 },
  sub: { ...type.body, fontSize: 14, color: colors.textDim, paddingHorizontal: space(6), marginTop: space(1) },
  grid: { paddingHorizontal: space(5), paddingTop: space(5), paddingBottom: space(4) },
  row: { gap: space(2) },
  cell: { flex: 1 / COLUMNS, marginBottom: space(2) },
  thumbWrap: {
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  num: {
    position: 'absolute',
    top: space(2),
    left: space(2),
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { ...type.mono, fontSize: 11, letterSpacing: 0, color: colors.accentInk },
  x: {
    position: 'absolute',
    top: space(2),
    right: space(2),
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xText: { fontSize: 11, fontWeight: '800', color: colors.text },
  addRow: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  add: {
    flex: 1,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addGlyph: { fontSize: 18, color: colors.accent },
  addText: { ...type.mono, color: colors.textDim },
  fullNote: { ...type.body, fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: space(2) },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
