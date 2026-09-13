import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion } from '../theme';

// Pip: a flashcard with a face. Built from plain Views so it renders on iOS,
// Android and web with no image assets, and so every expression is just a
// style change we can animate.
//
// Moods:
//   idle     - gentle bob, blinks now and then. Empty states, quiet moments.
//   thinking - eyes dart, slight lean. While the page is being read.
//   happy    - bounce, squinty eyes, big grin. Deck finished.

export default function Mascot({ mood = 'idle', size = 72, style }) {
  const reduce = useReducedMotion();

  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const look = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pop = useSharedValue(1);
  const jump = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;

    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    // A blink is a fast squash-and-open with a long pause; the pause is what
    // makes it read as a blink rather than a twitch.
    blink.value = withRepeat(
      withSequence(
        withDelay(3200, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;

    if (mood === 'thinking') {
      look.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 650, easing: Easing.inOut(Easing.quad) }),
          withTiming(-3, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      tilt.value = withSpring(-7, motion.soft);
    } else if (mood === 'happy') {
      look.value = withTiming(0, { duration: 200 });
      tilt.value = withSequence(
        withTiming(9, { duration: 110 }),
        withTiming(-9, { duration: 130 }),
        withTiming(5, { duration: 110 }),
        withSpring(0, motion.snap),
      );
      pop.value = withSequence(withSpring(1.18, motion.pop), withSpring(1, motion.soft));
      jump.value = withSequence(
        withTiming(-22, { duration: 220, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 320, mass: 0.6 }),
      );
    } else {
      look.value = withTiming(0, { duration: 250 });
      tilt.value = withSpring(0, motion.soft);
    }
  }, [mood, reduce]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value + jump.value },
      { rotate: `${tilt.value}deg` },
      { scale: pop.value },
    ],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: look.value }, { scaleY: blink.value }],
  }));

  const s = size / 72;
  const happy = mood === 'happy';
  const thinking = mood === 'thinking';

  return (
    <Animated.View style={[{ width: 72 * s, height: 88 * s }, style, bodyStyle]}>
      <View style={[styles.body, { width: 64 * s, height: 80 * s, borderRadius: 14 * s }]}>
        {/* Card "title line" - a hint that this is a flashcard, not a blob. */}
        <View style={[styles.rule, { top: 12 * s, width: 22 * s, height: 3 * s }]} />

        <View style={[styles.face, { top: 30 * s }]}>
          <View style={[styles.eyes, { gap: 12 * s }]}>
            {[0, 1].map((i) =>
              happy ? (
                <View
                  key={i}
                  style={[
                    styles.eyeHappy,
                    {
                      width: 11 * s,
                      height: 6 * s,
                      borderTopWidth: 3 * s,
                      borderTopLeftRadius: 6 * s,
                      borderTopRightRadius: 6 * s,
                    },
                  ]}
                />
              ) : (
                <Animated.View
                  key={i}
                  style={[
                    styles.eye,
                    { width: 8 * s, height: 8 * s, borderRadius: 4 * s },
                    eyeStyle,
                  ]}
                />
              ),
            )}
          </View>

          {happy ? (
            <View
              style={[
                styles.mouthHappy,
                {
                  width: 20 * s,
                  height: 10 * s,
                  borderBottomLeftRadius: 10 * s,
                  borderBottomRightRadius: 10 * s,
                  marginTop: 8 * s,
                },
              ]}
            />
          ) : thinking ? (
            <View
              style={[
                styles.mouthO,
                { width: 7 * s, height: 7 * s, borderRadius: 4 * s, marginTop: 9 * s },
              ]}
            />
          ) : (
            <View
              style={[
                styles.mouth,
                { width: 12 * s, height: 3 * s, borderRadius: 2 * s, marginTop: 10 * s },
              ]}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: {
    backgroundColor: colors.accent,
    alignSelf: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  rule: {
    position: 'absolute',
    left: '18%',
    backgroundColor: 'rgba(11,11,15,0.22)',
    borderRadius: 2,
  },
  face: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  eyes: { flexDirection: 'row', alignItems: 'center' },
  eye: { backgroundColor: colors.accentInk },
  eyeHappy: { borderColor: colors.accentInk, backgroundColor: 'transparent' },
  mouth: { backgroundColor: colors.accentInk },
  mouthO: { borderWidth: 2.5, borderColor: colors.accentInk, backgroundColor: 'transparent' },
  mouthHappy: { backgroundColor: colors.accentInk },
});
