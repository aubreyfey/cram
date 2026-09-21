import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Figure from './Figure';
import { colors, motion, radius, shadow, space, type } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
const EXIT_MS = 220;

const Flashcard = forwardRef(function Flashcard({ card, onRate, onExplain, depth = 0 }, ref) {
  const flip = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const gone = useSharedValue(0);

  // Cards behind the top one sit slightly back and down, so the deck reads as
  // a physical stack rather than a list.
  const settle = useSharedValue(depth);
  useEffect(() => {
    settle.value = withSpring(depth, motion.soft);
  }, [depth]);

  const isTop = depth === 0;

  const buzz = (rating) => {
    Haptics.notificationAsync(
      rating === 'again'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    );
  };

  const flipHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // Each rating leaves in its own direction, so the gesture and the buttons
  // produce the same motion and the deck never hard-cuts between cards.
  const exitFor = (rating) => {
    if (rating === 'again') return { dx: -SCREEN_W * 1.4, dy: 60 };
    if (rating === 'hard') return { dx: 0, dy: -SCREEN_H * 0.9 };
    return { dx: SCREEN_W * 1.4, dy: 60 };
  };

  const flyOut = (rating) => {
    if (gone.value) return;
    gone.value = 1;
    buzz(rating);
    const { dx, dy } = exitFor(rating);
    y.value = withTiming(y.value + dy, { duration: EXIT_MS });
    x.value = withTiming(dx, { duration: EXIT_MS }, (done) => {
      if (done) runOnJS(onRate)(rating);
    });
  };

  useImperativeHandle(ref, () => ({ flyOut }), [onRate]);

  // The "Why?" pill has its own tap; the card's flip waits for it to fail
  // so tapping the pill never flips the card back over.
  const whyTap = Gesture.Tap()
    .enabled(isTop && !!onExplain)
    .onEnd(() => {
      if (onExplain) runOnJS(onExplain)(card);
    });

  const tap = Gesture.Tap()
    .enabled(isTop)
    .requireExternalGestureToFail(whyTap)
    .onEnd(() => {
      flip.value = withSpring(flip.value > 0.5 ? 0 : 1, motion.snap);
      runOnJS(flipHaptic)();
    });

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      if (past) {
        const rating = e.translationX > 0 ? 'good' : 'again';
        gone.value = 1;
        runOnJS(buzz)(rating);
        y.value = withTiming(y.value + 60, { duration: EXIT_MS });
        // Report the rating only once the card has actually left the screen.
        // Calling it immediately lets the parent advance the queue and unmount
        // this card mid-flight, which cuts the exit animation to a hard pop.
        x.value = withTiming(
          (e.translationX > 0 ? 1 : -1) * SCREEN_W * 1.4,
          { duration: EXIT_MS },
          (done) => {
            if (done) runOnJS(onRate)(rating);
          },
        );
      } else {
        x.value = withSpring(0, motion.snap);
        y.value = withSpring(0, motion.snap);
      }
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + settle.value * 14 },
      { scale: 1 - settle.value * 0.05 },
      { rotate: `${(x.value / SCREEN_W) * 12}deg` },
    ],
    opacity: gone.value ? 1 : interpolate(settle.value, [0, 1, 2], [1, 0.7, 0.35]),
    zIndex: 10 - depth,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: flip.value > 0.5 ? 0 : 1,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: flip.value > 0.5 ? 1 : 0,
  }));

  // Swipe affordances - they fade in as you drag, so the gesture teaches itself
  // the first time without an onboarding screen.
  const againBadge = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-SWIPE_THRESHOLD, -20, 0], [1, 0, 0]),
  }));
  const goodBadge = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, 20, SWIPE_THRESHOLD], [0, 0, 1]),
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, tap)}>
      <Animated.View
        style={[styles.wrap, containerStyle]}
        pointerEvents={isTop ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.face, styles.front, frontStyle]}>
          <Text style={styles.kicker}>QUESTION</Text>
          <Figure figure={card.figure} side="front" height={140} />
          <Text
            style={[styles.prompt, card.figure?.side === 'front' && styles.promptWithFigure]}
            numberOfLines={card.figure?.side === 'front' ? 4 : undefined}
          >
            {card.front}
          </Text>
          {card.hint ? <Text style={styles.hint}>{card.hint}</Text> : null}
          {isTop ? <Text style={styles.tapCue}>tap to flip</Text> : null}
        </Animated.View>

        <Animated.View style={[styles.face, styles.back, backStyle]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>ANSWER</Text>
          <Figure figure={card.figure} side="back" height={150} />
          <Text style={styles.answer} numberOfLines={card.figure?.side === 'back' ? 5 : undefined}>
            {card.back}
          </Text>
          {/* "Why?" - a tap here must not flip the card back, so it is its
              own Pressable and the tap gesture is told to ignore it. */}
          {isTop && onExplain ? (
            <GestureDetector gesture={whyTap}>
              <View style={[styles.why, card.explanation && styles.whyHave]} hitSlop={8}>
                <Text style={styles.whyText}>{card.explanation ? 'WHY ↗' : 'WHY?'}</Text>
              </View>
            </GestureDetector>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.badge, styles.badgeLeft, againBadge]}>
          <Text style={[styles.badgeText, { color: colors.again }]}>AGAIN</Text>
        </Animated.View>
        <Animated.View style={[styles.badge, styles.badgeRight, goodBadge]}>
          <Text style={[styles.badgeText, { color: colors.good }]}>GOT IT</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

export default Flashcard;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space(6),
    right: space(6),
    top: 0,
    height: 420,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    padding: space(7),
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    ...shadow.card,
  },
  front: { backgroundColor: colors.surfaceHi, borderColor: colors.line },
  back: { backgroundColor: colors.surface, borderColor: colors.accent + '44' },
  kicker: {
    ...type.mono,
    color: colors.textFaint,
    position: 'absolute',
    top: space(6),
    left: space(7),
  },
  prompt: { ...type.card, color: colors.text },
  // With a picture above it the question has less room; drop a size.
  promptWithFigure: { fontSize: 19, lineHeight: 26 },
  answer: { ...type.body, fontSize: 19, lineHeight: 27, color: colors.text },
  hint: { ...type.body, color: colors.textDim, marginTop: space(4), fontSize: 14 },
  why: {
    position: 'absolute',
    bottom: space(5),
    right: space(6),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent + '88',
  },
  whyHave: { backgroundColor: colors.accent + '22' },
  whyText: { ...type.mono, fontSize: 10, color: colors.accent },
  tapCue: {
    ...type.mono,
    color: colors.textFaint,
    position: 'absolute',
    bottom: space(6),
    alignSelf: 'center',
  },
  badge: {
    position: 'absolute',
    top: space(8),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.sm,
    borderWidth: 2,
  },
  badgeLeft: { right: space(6), borderColor: colors.again, transform: [{ rotate: '12deg' }] },
  badgeRight: { left: space(6), borderColor: colors.good, transform: [{ rotate: '-12deg' }] },
  badgeText: { ...type.label },
});
