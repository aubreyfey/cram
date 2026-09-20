import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Mascot from './Mascot';
import { colors, motion, space, type } from '../theme';

// The first second. The native splash shows Volt still, on the dark ground;
// this picks up from that exact frame so there is no cut: Volt wakes up, the
// wordmark rises, a line of what the app does, then the whole thing dissolves
// into the camera. Tap anywhere to skip. Reduced motion skips it entirely.
//
// Not onboarding. Nothing to read, nothing to tap, over before it is
// annoying - a brand moment, not a gate.
const HOLD_MS = 1500;

export default function Opening({ onDone }) {
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);

  const veil = useSharedValue(1);
  const owl = useSharedValue(1);
  const owlY = useSharedValue(0);
  const word = useSharedValue(0);
  const line = useSharedValue(0);
  const [mood, setMood] = useState('idle');

  const finish = () => {
    if (gone) return;
    setGone(true);
    onDone?.();
  };

  useEffect(() => {
    if (reduce) {
      finish();
      return;
    }
    // Wake: a small hop with the happy face, then settle.
    setTimeout(() => setMood('happy'), 120);
    setTimeout(() => setMood('idle'), 900);
    owl.value = withSequence(withSpring(1.12, motion.pop), withSpring(1, motion.soft));
    owlY.value = withDelay(350, withSpring(-28, motion.soft));
    word.value = withDelay(380, withSpring(1, motion.soft));
    line.value = withDelay(650, withTiming(1, { duration: 320 }));
    veil.value = withDelay(
      HOLD_MS,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
    // Belt and braces: whatever the animation runtime does, the opening is
    // gone by here. An intro that can hang is worse than no intro.
    const t = setTimeout(finish, HOLD_MS + 900);
    return () => clearTimeout(t);
  }, [reduce]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const owlStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: owlY.value }, { scale: owl.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: line.value }));

  if (gone) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, veilStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} />
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={owlStyle}>
          <Mascot mood={mood} size={132} />
        </Animated.View>
        <Animated.Text style={[styles.wordmark, wordStyle]}>CRAM</Animated.Text>
        <Animated.Text style={[styles.line, lineStyle]}>POINT · SHOOT · STUDY</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    ...type.hero,
    fontSize: 34,
    letterSpacing: 8,
    color: colors.text,
    marginTop: space(4),
    // Android's letterSpacing shifts the glyphs right; nudge it back.
    marginLeft: Platform.OS === 'android' ? 8 : 0,
  },
  line: { ...type.mono, color: colors.textFaint, marginTop: space(3) },
});
