import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { speechAvailable, startListening } from '../lib/speech';
import { fmtDuration, keepRecording } from '../lib/talks';
import { alert } from '../lib/alert';
import { colors, motion, radius, space, type } from '../theme';

// Talk it out. Explain the material to your phone as if to a friend; the
// words show up as you say them. If you can't explain it, you don't know it
// yet - that is the whole method. Afterwards: keep it (your own podcast),
// fix the transcript, or turn it into cards.
//
// Who records the audio depends on what's available:
//   native + speech recogniser  -> the recogniser records (one mic user)
//   native, Expo Go             -> expo-audio records, no live transcript
//   web                         -> expo-audio records, Web Speech transcribes
const MAX_SECONDS = 15 * 60;

export default function TalkScreen({ context, onSave, onMakeCards, onClose }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState('idle'); // idle | recording | review
  const [canTranscribe, setCanTranscribe] = useState(null);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null); // { uri, duration }
  const [title, setTitle] = useState(context?.title ? `${context.title} - talked through` : '');
  const [transcript, setTranscript] = useState('');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 500);
  const listener = useRef(null);
  const usingRecognizerAudio = useRef(false);
  const timer = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => {
    speechAvailable().then(setCanTranscribe);
    return () => {
      clearInterval(timer.current);
      listener.current?.dispose?.();
    };
  }, []);

  const start = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        alert('Microphone is off', 'Allow the microphone for Cram to record.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      setFinalText('');
      setInterim('');
      setSeconds(0);
      startedAt.current = Date.now();

      // The recogniser records its own file on native so the mic has one
      // owner. On web (or without a recogniser) expo-audio records.
      const persist = Platform.OS !== 'web';
      listener.current = canTranscribe
        ? await startListening({
            persist,
            onText: (fin, part) => {
              setFinalText(fin);
              setInterim(part);
            },
            onEnd: ({ text, uri }) => finish({ text, uri }),
            onError: (e) => alert('Listening stopped', e.message),
          })
        : null;
      usingRecognizerAudio.current = !!(listener.current && persist);

      if (!usingRecognizerAudio.current) {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }

      setPhase('recording');
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 500);
    } catch (e) {
      alert("Couldn't start", e.message);
    }
  };

  const pendingStop = useRef(null);
  const stop = async () => {
    clearInterval(timer.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    if (usingRecognizerAudio.current) {
      // The file arrives on the recogniser's 'end' event -> finish().
      pendingStop.current = { duration };
      listener.current?.stop();
      return;
    }
    listener.current?.stop();
    await recorder.stop();
    finish({ text: null, uri: recorder.uri, duration });
  };

  const finish = async ({ text, uri, duration }) => {
    listener.current?.dispose?.();
    listener.current = null;
    const d = duration ?? pendingStop.current?.duration ?? seconds;
    pendingStop.current = null;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setResult({ uri, duration: d });
    setTranscript((text ?? finalText).trim());
    setPhase('review');
  };

  const save = async (andMakeCards) => {
    if (!result?.uri) {
      alert('Nothing recorded', 'Try again - hold the button and talk.');
      return;
    }
    const id = `talk_${Date.now()}`;
    const uri = await keepRecording(id, result.uri);
    const talk = {
      id,
      title: title.trim() || 'Untitled talk',
      uri,
      duration: result.duration,
      transcript: transcript.trim(),
      deckId: context?.deckId ?? null,
      examId: context?.examId ?? null,
      createdAt: Date.now(),
    };
    await onSave(talk);
    if (andMakeCards) {
      if (talk.transcript.length < 40) {
        alert('Not enough words', 'Cards need a bit more than that - say a few more sentences or type them in.');
        return;
      }
      onMakeCards(talk);
    }
  };

  if (phase === 'review') {
    return (
      <Review
        insets={insets}
        result={result}
        title={title}
        setTitle={setTitle}
        transcript={transcript}
        setTranscript={setTranscript}
        canTranscribe={canTranscribe}
        onRedo={() => {
          setResult(null);
          setPhase('idle');
        }}
        onSave={() => save(false)}
        onMakeCards={() => save(true)}
        onClose={onClose}
      />
    );
  }

  const recording = phase === 'recording';
  const live = `${finalText}${interim ? ` ${interim}` : ''}`.trim();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={recording ? undefined : onClose} hitSlop={16} disabled={recording}>
          <Text style={[styles.close, recording && { opacity: 0.3 }]}>Cancel</Text>
        </Pressable>
        <Text style={styles.kicker}>{recording ? fmtDuration(seconds) : 'TALK IT OUT'}</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.stage}>
        {!recording ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.intro}>
            <Mascot mood="idle" size={72} />
            <Text style={styles.introTitle}>
              {context?.title ? `Explain "${context.title}" out loud` : 'Explain what you just learned'}
            </Text>
            <Text style={styles.introBody}>
              Like you're teaching a friend. If you can't say it, you don't have it yet - that's the point.
              {canTranscribe === false
                ? '\n\nLive transcript needs the full app build; in Expo Go you can still record and type the words after.'
                : ''}
            </Text>
          </Animated.View>
        ) : (
          <ScrollView style={styles.liveBox} contentContainerStyle={{ padding: space(5) }}>
            <Mascot mood="thinking" size={40} style={{ marginBottom: space(3) }} />
            {live ? (
              <Text style={styles.live}>
                {finalText}
                {interim ? <Text style={styles.interim}> {interim}</Text> : null}
              </Text>
            ) : (
              <Text style={styles.listening}>
                {canTranscribe ? 'Listening…' : 'Recording…'}
                {recState.metering != null ? '' : ''}
              </Text>
            )}
          </ScrollView>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + space(6) }]}>
        <RecordButton recording={recording} onPress={recording ? stop : start} />
        <Text style={styles.hint}>{recording ? 'Tap to stop' : 'Tap to start'}</Text>
      </View>
    </View>
  );
}

function RecordButton({ recording, onPress }) {
  const pulse = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    pulse.value = recording
      ? withRepeat(
          withSequence(
            withTiming(1.25, { duration: 700, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        )
      : withTiming(1, { duration: 200 });
  }, [recording]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: recording ? 0.35 : 0 }));
  const btn = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.recWrap}>
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={btn}>
        <Pressable
          onPressIn={() => {
            scale.value = withSpring(0.92, motion.pop);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, motion.pop);
          }}
          onPress={onPress}
          style={styles.rec}
        >
          <View style={[styles.recInner, recording && styles.recInnerStop]} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Review({ insets, result, title, setTitle, transcript, setTranscript, canTranscribe, onRedo, onSave, onMakeCards, onClose }) {
  const player = useAudioPlayer(result?.uri ? { uri: result.uri } : null);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration && status.currentTime >= status.duration - 0.2)) player.seekTo(0);
      player.play();
    }
  };
  const pct = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + space(2) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Discard</Text>
        </Pressable>
        <Text style={styles.kicker}>{fmtDuration(result?.duration)}</Text>
        <Pressable onPress={onRedo} hitSlop={16}>
          <Text style={styles.redo}>Redo</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.reviewBody, { paddingBottom: space(6) }]} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Name this talk"
          placeholderTextColor={colors.textFaint}
        />

        <Pressable onPress={toggle} style={styles.player}>
          <View style={styles.playBtn}>
            <Text style={styles.playGlyph}>{status.playing ? '❚❚' : '▶'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.time}>
              {fmtDuration(status.currentTime)} / {fmtDuration(status.duration || result?.duration)}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.label}>
          {canTranscribe ? 'WHAT YOU SAID · FIX ANYTHING IT MISHEARD' : 'WHAT YOU SAID · TYPE IT OUT'}
        </Text>
        <TextInput
          style={styles.transcript}
          value={transcript}
          onChangeText={setTranscript}
          multiline
          placeholder={canTranscribe ? 'Nothing came through - try again closer to the mic, or type it.' : 'The gist, in your words. Cards come from this.'}
          placeholderTextColor={colors.textFaint}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton label="Make cards from this" onPress={onMakeCards} />
        <PrimaryButton label="Just keep it" variant="ghost" onPress={onSave} style={{ marginTop: space(3) }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(6) },
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56 },
  redo: { ...type.body, fontWeight: '700', color: colors.accent, width: 56, textAlign: 'right' },
  kicker: { ...type.mono, color: colors.textDim },
  stage: { flex: 1, paddingHorizontal: space(6), paddingTop: space(6) },
  intro: { alignItems: 'center', paddingHorizontal: space(4), marginTop: space(10) },
  introTitle: { ...type.title, fontSize: 24, color: colors.text, textAlign: 'center', marginTop: space(6) },
  introBody: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(3) },
  liveBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '55',
  },
  live: { ...type.body, fontSize: 19, lineHeight: 28, color: colors.text },
  interim: { color: colors.textDim },
  listening: { ...type.mono, color: colors.textFaint },
  controls: { alignItems: 'center', paddingTop: space(4) },
  recWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accent },
  rec: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.accent },
  recInnerStop: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.again },
  hint: { ...type.mono, color: colors.textFaint, marginTop: space(3) },
  reviewBody: { paddingHorizontal: space(6), paddingTop: space(3) },
  titleInput: { ...type.title, fontSize: 22, color: colors.text, paddingVertical: space(2) },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    marginTop: space(4),
  },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { fontSize: 16, fontWeight: '800', color: colors.accentInk },
  track: { height: 3, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
  time: { ...type.mono, color: colors.textFaint, marginTop: space(2) },
  label: { ...type.mono, color: colors.textFaint, marginTop: space(6), marginBottom: space(2) },
  transcript: {
    ...type.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space(4),
    minHeight: 160,
    textAlignVertical: 'top',
  },
  footer: { paddingHorizontal: space(6), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
});
