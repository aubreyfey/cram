import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import PrimaryButton from '../components/PrimaryButton';
import { colors, motion, radius, space, type } from '../theme';

export default function CameraScreen({
  onCapture,
  onOpenLibrary,
  onOpenSource,
  quota,
  appendTo,
  onCancelAppend,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  const shutter = useSharedValue(1);
  const flash = useSharedValue(0);

  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutter.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const capture = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shutter.value = withSpring(0.82, motion.pop, () => {
      shutter.value = withSpring(1, motion.pop);
    });
    flash.value = withTiming(1, { duration: 60 }, () => {
      flash.value = withTiming(0, { duration: 220 });
    });

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      onCapture({ uri: photo.uri, kind: 'image' });
    } catch {
      // A failed frame is not worth an alert - the user just taps again.
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: space(8) }]}>
        <Text style={styles.permTitle}>Point it at your notes</Text>
        <Text style={styles.permBody}>
          Cram needs the camera to read your slides and turn them into flashcards.
        </Text>
        <PrimaryButton
          label="Enable camera"
          onPress={requestPermission}
          style={{ marginTop: space(8) }}
        />
        {/* Without this, denying the permission leaves you on a dead-end
            screen with no way back to decks you've already made. */}
        <PrimaryButton
          label="See my decks"
          variant="ghost"
          onPress={onOpenLibrary}
          style={{ marginTop: space(3), alignSelf: 'stretch' }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
        pointerEvents="none"
      />

      {/* Framing guide. Corners only - a full box makes people try to line the
          page up perfectly, which they will not do, and then it feels broken. */}
      <View style={styles.guide} pointerEvents="none">
        {['tl', 'tr', 'bl', 'br'].map((c) => (
          <View key={c} style={[styles.corner, styles[c]]} />
        ))}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <Text style={styles.wordmark}>CRAM</Text>
        {quota.remaining !== Infinity ? (
          <View style={styles.quotaPill}>
            <Text style={styles.quotaText}>{quota.remaining} CARDS LEFT</Text>
          </View>
        ) : (
          <View style={[styles.quotaPill, styles.proPill]}>
            <Text style={[styles.quotaText, { color: colors.accentInk }]}>PRO</Text>
          </View>
        )}
      </View>

      {/* Append mode. The banner is the only thing that says the next scan
          goes into an existing deck, so it has to be impossible to miss and
          one tap to get out of. */}
      {appendTo ? (
        <View style={[styles.appendBar, { top: insets.top + space(14) }]}>
          <Text style={styles.appendText} numberOfLines={1}>
            ADDING TO  <Text style={{ color: colors.text }}>{appendTo.title}</Text>
          </Text>
          <Pressable onPress={onCancelAppend} hitSlop={12}>
            <Text style={styles.appendCancel}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.caption, { bottom: insets.bottom + space(30) }]}>
        {appendTo ? 'Scan the next page of this deck' : 'Slides, textbook, handwriting, or a PDF'}
      </Text>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space(6) }]}>
        <Pressable onPress={onOpenLibrary} style={styles.sideSlot} hitSlop={16}>
          <Text style={styles.libraryText}>Decks</Text>
        </Pressable>

        <Animated.View style={shutterStyle}>
          <Pressable onPress={capture} style={styles.shutterOuter} disabled={busy}>
            <View style={styles.shutterInner} />
          </Pressable>
        </Animated.View>

        <Pressable onPress={onOpenSource} style={styles.sideSlot} hitSlop={16}>
          <Text style={[styles.libraryText, styles.importText]}>Import</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: { backgroundColor: '#fff' },
  permTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  permBody: {
    ...type.body,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space(3),
  },
  guide: {
    position: 'absolute',
    top: '22%',
    bottom: '30%',
    left: space(8),
    right: space(8),
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: colors.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.sm },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.sm },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.sm,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.sm,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: { ...type.label, fontSize: 16, letterSpacing: 3, color: colors.text },
  quotaPill: {
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  proPill: { backgroundColor: colors.accent },
  appendBar: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '84%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.accent + '88',
  },
  appendText: { ...type.mono, color: colors.accent, flexShrink: 1 },
  appendCancel: { ...type.body, fontWeight: '700', color: colors.textDim },
  quotaText: { ...type.mono, color: colors.text },
  caption: {
    position: 'absolute',
    alignSelf: 'center',
    ...type.mono,
    color: 'rgba(255,255,255,0.55)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(8),
  },
  sideSlot: { width: 64 },
  importText: { textAlign: 'right', color: colors.accent },
  libraryText: { ...type.body, fontWeight: '700', color: colors.text },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent },
});
