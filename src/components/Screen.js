import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInRight,
  SlideOutDown,
  SlideOutRight,
} from 'react-native-reanimated';
import { colors } from '../theme';

// Three transition roles, matching how iOS itself distinguishes them:
//   fade  - swapping the root view (camera <-> generating)
//   push  - going deeper into a hierarchy (decks, a deck's cards)
//   modal - something that interrupts and can be dismissed (the paywall)
// Using the same motion for all three is what makes an app feel like a website.
const PRESETS = {
  fade: {
    entering: FadeIn.duration(200),
    exiting: FadeOut.duration(140),
  },
  push: {
    entering: SlideInRight.springify().damping(24).stiffness(180),
    exiting: SlideOutRight.duration(200),
  },
  modal: {
    entering: SlideInDown.springify().damping(26).stiffness(160),
    exiting: SlideOutDown.duration(220),
  },
};

export default function Screen({ preset = 'fade', children, style }) {
  const { entering, exiting } = PRESETS[preset] ?? PRESETS.fade;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.base, style]}
      entering={entering}
      exiting={exiting}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Opaque so the outgoing screen never bleeds through mid-transition.
  base: { backgroundColor: colors.bg },
});
