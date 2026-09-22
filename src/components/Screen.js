import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInRight,
  SlideOutDown,
  SlideOutRight,
} from 'react-native-reanimated';
import { colors } from '../theme';
import { READABLE, useLayout } from '../lib/layout';

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

// maxWidth: on an iPad or a desktop browser, content screens sit in a
// centred column of this width instead of stretching a phone layout across
// the whole pane. Push and modal screens get a readable column by default;
// fade screens (camera, generating) are full-bleed. Pass null to opt out,
// or a number to widen (the Library).
export default function Screen({ preset = 'fade', maxWidth, children, style }) {
  const { entering, exiting } = PRESETS[preset] ?? PRESETS.fade;
  const { width } = useLayout();
  const cap = maxWidth === undefined ? (preset === 'fade' ? null : READABLE) : maxWidth;
  const column = cap && width > cap;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.base, style]}
      entering={entering}
      exiting={exiting}
    >
      {column ? <View style={[styles.column, { width: cap }]}>{children}</View> : children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Opaque so the outgoing screen never bleeds through mid-transition.
  base: { backgroundColor: colors.bg },
  column: { flex: 1, alignSelf: 'center' },
});
