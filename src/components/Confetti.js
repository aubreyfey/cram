import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

const PALETTE = [colors.accent, colors.violet, colors.good, colors.hard, colors.again, colors.text];

// Deterministic-enough randomness per piece, computed once on mount.
function makePieces(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x0: (Math.random() - 0.5) * W * 0.9,
    drift: (Math.random() - 0.5) * 120,
    fall: H * (0.55 + Math.random() * 0.4),
    delay: Math.random() * 260,
    duration: 1500 + Math.random() * 900,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
    size: 6 + Math.random() * 6,
    tall: Math.random() > 0.5,
    color: PALETTE[i % PALETTE.length],
  }));
}

function Piece({ p }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      p.delay,
      // Ease-in so it accelerates like something actually falling.
      withTiming(1, { duration: p.duration, easing: Easing.in(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.75 ? 1 : 1 - (t.value - 0.75) / 0.25,
    transform: [
      { translateX: p.x0 + p.drift * t.value },
      { translateY: -40 + p.fall * t.value },
      { rotate: `${p.spin * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: p.tall ? p.size * 0.55 : p.size,
          height: p.tall ? p.size * 1.6 : p.size,
          backgroundColor: p.color,
          borderRadius: p.tall ? 1 : p.size / 3,
        },
        style,
      ]}
    />
  );
}

// Fires once on mount. Mount it when there is something to celebrate and let
// it unmount with its parent - it has no state to reset.
export default function Confetti({ count = 42 }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => makePieces(count), [count]);

  if (reduce) return null;

  return (
    <Animated.View style={styles.layer} pointerEvents="none">
      {pieces.map((p) => (
        <Piece key={p.id} p={p} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: '18%',
    zIndex: 50,
  },
  piece: { position: 'absolute' },
});
