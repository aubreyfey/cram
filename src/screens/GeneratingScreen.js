import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, space, type } from '../theme';

// The request usually lands in 2-4s. Silence for that long reads as a hang, so
// we narrate it. The steps are honest about what is happening, in order.
const STEPS = ['Reading the page', 'Finding the concepts', 'Writing your cards'];

export default function GeneratingScreen({ photoUri, error, onRetry, onCancel }) {
  const [step, setStep] = useState(0);
  const [frameH, setFrameH] = useState(0);
  const insets = useSafeAreaInsets();

  const scan = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    scan.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, [error]);

  // translateY rather than an animated `top`: percentage layout props run on the
  // JS thread and stutter exactly when the device is busy encoding the photo.
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * frameH }],
    opacity: 0.9 - Math.abs(scan.value - 0.5),
  }));

  const frameStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View
        style={[styles.frame, frameStyle]}
        onLayout={(e) => setFrameH(e.nativeEvent.layout.height)}
      >
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}
        <View style={styles.veil} />
        {!error ? <Animated.View style={[styles.scanline, scanStyle]} /> : null}
      </Animated.View>

      {error ? (
        <View style={styles.status}>
          <Text style={styles.errorTitle}>{error.message}</Text>
          <View style={styles.actions}>
            <PrimaryButton label="Try again" onPress={onRetry} />
            <PrimaryButton
              label="Back"
              variant="ghost"
              onPress={onCancel}
              style={{ marginTop: space(3) }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.status}>
          <Text style={styles.step}>{STEPS[step]}</Text>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i <= step && { backgroundColor: colors.accent }]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  frame: {
    marginTop: space(10),
    width: '78%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  photo: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,11,15,0.55)' },
  scanline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space(8) },
  step: { ...type.title, fontSize: 22, color: colors.text },
  errorTitle: { ...type.body, fontSize: 18, color: colors.text, textAlign: 'center' },
  actions: { marginTop: space(8), alignSelf: 'stretch' },
  dots: { flexDirection: 'row', marginTop: space(5), gap: space(2) },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.line },
});
