import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync } from 'expo-audio';
import { RATING } from '../lib/srs';
import { colors, radius, space, type } from '../theme';

// Listen: the deck read aloud, for the walk to class. Question, a beat to
// think, answer, a beat, next card - hands in pockets the whole way. A tap
// on Again or Got it rates the card like any other mode; no tap and the
// card just moves on, unrated, because a walk is for hearing the material
// again, not for grading yourself on the crossing.
//
// Runs with the screen on; iOS keeps the voice going with the phone in a
// pocket as long as the app is in front. Speech uses the app's audio
// session, so the same playback mode Talks uses gets it past the silent
// switch.
const THINK_MS = 3500;
const AFTER_MS = 2200;
const RATE = 0.95;

export default function ListenStage({ card, onRate, onSkip }) {
  const [playing, setPlaying] = useState(true);
  // 'question' | 'answer'
  const [phase, setPhase] = useState('question');
  const timer = useRef(null);
  // Guards against a callback from a card that has already moved on: every
  // utterance carries the id it was started for.
  const current = useRef(card?.id);

  // Playback category, like Talks: audible with the silent switch on.
  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, []);

  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const speak = (text, then) => {
    const id = card?.id;
    Speech.stop();
    Speech.speak(text, {
      rate: RATE,
      onDone: () => {
        if (current.current === id) then();
      },
      onError: () => {
        if (current.current === id) then();
      },
    });
  };

  // One card, start to finish. Restarts whenever the card changes or play
  // resumes; stops cleanly when either goes away.
  useEffect(() => {
    current.current = card?.id;
    clear();
    Speech.stop();
    setPhase('question');
    if (!card || !playing) return undefined;

    speak(card.front, () => {
      timer.current = setTimeout(() => {
        if (current.current !== card.id) return;
        setPhase('answer');
        speak(card.back, () => {
          timer.current = setTimeout(() => {
            if (current.current === card.id) onSkip();
          }, AFTER_MS);
        });
      }, THINK_MS);
    });

    return () => {
      clear();
      Speech.stop();
    };
  }, [card?.id, playing]);

  const rate = (r) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clear();
    Speech.stop();
    onRate(r);
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaying((p) => !p);
  };

  if (!card) return null;

  return (
    <View style={styles.root}>
      <View style={styles.sheet}>
        <Text style={styles.kicker}>{phase === 'answer' ? 'ANSWER' : 'QUESTION'}</Text>
        <Text style={styles.q}>{card.front}</Text>
        {phase === 'answer' ? (
          <Animated.Text entering={FadeIn.duration(200)} style={styles.a}>
            {card.back}
          </Animated.Text>
        ) : (
          <Text style={styles.wait}>{playing ? 'thinking time…' : 'paused'}</Text>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => rate(RATING.AGAIN)} style={[styles.side, { borderColor: colors.again + '88' }]} hitSlop={8}>
          <Text style={[styles.sideText, { color: colors.again }]}>Again</Text>
        </Pressable>
        <Pressable onPress={toggle} style={[styles.play, playing && styles.playOn]} hitSlop={8}>
          <Text style={[styles.playGlyph, playing && { color: colors.accentInk }]}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Pressable onPress={() => rate(RATING.GOOD)} style={[styles.side, { borderColor: colors.good + '88' }]} hitSlop={8}>
          <Text style={[styles.sideText, { color: colors.good }]}>Got it</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>No tap needed - cards move on by themselves. Tap to rate one.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space(6) },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(6),
    justifyContent: 'center',
  },
  kicker: { ...type.mono, color: colors.textFaint, position: 'absolute', top: space(5), left: space(6) },
  q: { ...type.card, color: colors.text },
  a: { ...type.body, fontSize: 18, lineHeight: 26, color: colors.accent, marginTop: space(5) },
  wait: { ...type.mono, color: colors.textFaint, marginTop: space(5) },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(4),
    marginTop: space(5),
  },
  side: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space(4),
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  sideText: { ...type.label, fontSize: 15 },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.line,
  },
  playOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  playGlyph: { fontSize: 24, color: colors.text },
  hint: { ...type.body, fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: space(4) },
});
