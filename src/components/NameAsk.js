import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Mascot from './Mascot';
import PrimaryButton from './PrimaryButton';
import { firstName, markAsked, setName } from '../lib/profile';
import { colors, motion, radius, space, type } from '../theme';

// Right after the opening, once, ever: Volt asks what to call you. One
// field, a skip that is as easy to hit as the button, and the camera is
// already there behind it. Volt watches the field - idle while it is empty,
// thinking while you type, delighted when there is a name - then says hi
// and gets out of the way.
export default function NameAsk({ onDone }) {
  const [name, setNameState] = useState('');
  const [phase, setPhase] = useState('ask'); // ask | hi
  const [mood, setMood] = useState('idle');
  const typing = useRef(null);

  const card = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    card.value = withDelay(120, withSpring(1, motion.soft));
  }, []);

  // Thinking while keys are going down; happy once they stop and there is
  // something there; back to idle if it is cleared.
  const onChange = (t) => {
    setNameState(t);
    setMood('thinking');
    clearTimeout(typing.current);
    typing.current = setTimeout(() => setMood(t.trim() ? 'happy' : 'idle'), 450);
  };

  const finish = async (save) => {
    clearTimeout(typing.current);
    if (save && name.trim()) {
      await setName(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMood('happy');
      hop.value = withSequence(withSpring(-16, motion.pop), withSpring(0, motion.soft));
      setPhase('hi');
      setTimeout(() => onDone(name.trim()), 1100);
      return;
    }
    await markAsked();
    onDone('');
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * 24 }, { scale: 0.96 + card.value * 0.04 }],
  }));
  const owlStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(260)} style={[StyleSheet.absoluteFill, styles.root]}>
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.owl, owlStyle]}>
            <Mascot mood={mood} size={96} />
          </Animated.View>

          {phase === 'hi' ? (
            <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: 'center' }}>
              <Text style={styles.title}>Hi, {firstName(name)}.</Text>
              <Text style={styles.sub}>Let's make some cards.</Text>
            </Animated.View>
          ) : (
            <>
              <Text style={styles.title}>What should I call you?</Text>
              <Text style={styles.sub}>Just a first name is fine. It stays on this phone.</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={onChange}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => finish(true)}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                maxLength={40}
              />
              <PrimaryButton
                label={name.trim() ? `That's me` : 'Skip for now'}
                variant={name.trim() ? 'accent' : 'solid'}
                onPress={() => finish(!!name.trim())}
                style={{ marginTop: space(4), alignSelf: 'stretch' }}
              />
              {name.trim() ? (
                <Pressable onPress={() => finish(false)} hitSlop={10} style={{ marginTop: space(3) }}>
                  <Text style={styles.skip}>Skip</Text>
                </Pressable>
              ) : (
                <Text style={styles.skipHint}>You can add it later in Settings.</Text>
              )}
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(11,11,15,0.82)', zIndex: 90, elevation: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6) },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space(6),
    paddingTop: space(2),
    paddingBottom: space(6),
  },
  owl: { marginTop: -space(12), marginBottom: space(2) },
  title: { ...type.title, fontSize: 24, color: colors.text, textAlign: 'center' },
  sub: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center', marginTop: space(2) },
  input: {
    ...type.body,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    marginTop: space(5),
  },
  skip: { ...type.body, fontSize: 14, fontWeight: '700', color: colors.textDim },
  skipHint: { ...type.body, fontSize: 12, color: colors.textFaint, marginTop: space(3) },
});
