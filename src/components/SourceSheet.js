import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, motion, radius, space, type } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');

const OPTIONS = [
  {
    key: 'camera',
    glyph: '􀌞',
    fallback: '⌖',
    title: 'Take a photo',
    subtitle: 'Point at a slide or your notes',
  },
  {
    key: 'library',
    glyph: '􀏅',
    fallback: '▣',
    title: 'Photo library',
    subtitle: 'One photo or a whole set of them',
  },
  {
    key: 'files',
    glyph: '􀈹',
    fallback: '▤',
    title: 'PDF or document',
    pro: true,
    subtitle: 'Lecture slides, a chapter, a past paper',
  },
  {
    key: 'write',
    glyph: '􀈎',
    fallback: '✎',
    title: 'Write or paste',
    free: true,
    subtitle: 'Type cards, or paste notes or a shared deck',
  },
];

export default function SourceSheet({ visible, isPro, onPick, onClose }) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    progress.value = visible
      ? withSpring(1, motion.soft)
      : withTiming(0, { duration: 180 });
    if (visible) drag.value = 0;
  }, [visible]);

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const choose = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPick(key);
  };

  // Drag down to dismiss - past a third of the sheet's travel it commits,
  // otherwise it springs back, which is the gesture people already expect
  // from every other iOS sheet.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 800) {
        drag.value = withTiming(320, { duration: 160 });
        progress.value = withTiming(0, { duration: 160 }, (done) => {
          if (done) runOnJS(onClose)();
        });
      } else {
        drag.value = withSpring(0, motion.snap);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.6,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [SCREEN_H * 0.5, 0]) + drag.value },
    ],
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      </Pressable>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + space(4) }, sheetStyle]}
        >
          <View style={styles.grabber} />
          <Text style={styles.heading}>Make a deck from</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => choose(opt.key)}
              >
                <View style={styles.glyphWrap}>
                  <Text style={styles.glyph}>{opt.fallback}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <Text style={styles.optionSub}>{opt.subtitle}</Text>
                </View>
                {opt.pro && !isPro ? (
                  <View style={styles.proTag}>
                    <Text style={styles.proTagText}>PRO</Text>
                  </View>
                ) : opt.free && !isPro ? (
                  <View style={[styles.proTag, { borderColor: colors.textFaint }]}>
                    <Text style={[styles.proTagText, { color: colors.textDim }]}>FREE</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={dismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space(5),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginBottom: space(5),
  },
  heading: {
    ...type.mono,
    color: colors.textFaint,
    marginLeft: space(2),
    marginBottom: space(3),
  },
  options: { gap: space(2) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
  },
  optionPressed: { opacity: 0.6 },
  glyphWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18, color: colors.accentInk, fontWeight: '700' },
  optionTitle: { ...type.body, fontSize: 16, fontWeight: '700', color: colors.text },
  optionSub: { ...type.body, fontSize: 13, color: colors.textDim, marginTop: 1 },
  chevron: { fontSize: 22, color: colors.textFaint },
  proTag: {
    paddingHorizontal: space(2),
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  proTagText: { ...type.mono, fontSize: 10, color: colors.accent },
  cancel: {
    marginTop: space(3),
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cancelText: { ...type.body, fontWeight: '700', color: colors.textDim },
});
