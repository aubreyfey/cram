import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, motion, radius, space, type } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PrimaryButton({ label, onPress, variant = 'accent', style }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.pop);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.pop);
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={[styles.base, styles[variant], animated, style]}
    >
      <Text style={[styles.label, variant === 'accent' ? styles.inkDark : styles.inkLight]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(8),
  },
  accent: { backgroundColor: colors.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  solid: { backgroundColor: colors.surfaceHi },
  label: { ...type.body, fontSize: 17, fontWeight: '700' },
  inkDark: { color: colors.accentInk },
  inkLight: { color: colors.text },
});
