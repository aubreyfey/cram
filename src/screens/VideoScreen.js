import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import { fetchYouTube } from '../lib/api';
import { colors, radius, space, type } from '../theme';

// A YouTube video inside Cram: watch it here, make cards from it. The
// captions come from the server when YouTube allows it; when it doesn't -
// which is often, from a server - the screen says exactly what to do
// instead, and the paste box is right there. Either way the deck keeps the
// video, so "Open the video" brings you back to this screen.
export default function VideoScreen({ video, canGenerate, onMakeCards, onClose }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(canGenerate ? 'loading' : 'view'); // loading | ready | fallback | view
  const [info, setInfo] = useState({ videoId: video.videoId, title: video.title || null, transcript: null });
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canGenerate) return;
    let alive = true;
    fetchYouTube(video.url || video.videoId)
      .then((r) => {
        if (!alive) return;
        setInfo({ videoId: r.videoId || video.videoId, title: r.title, transcript: r.transcript, seconds: r.seconds, auto: r.auto, reason: r.reason });
        setState(r.transcript ? 'ready' : 'fallback');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setState('fallback');
      });
    return () => {
      alive = false;
    };
  }, [video.videoId]);

  const title = info.title || video.title || 'YouTube video';
  const source = { kind: 'youtube', videoId: info.videoId, title, url: `https://www.youtube.com/watch?v=${info.videoId}` };
  const minutes = info.seconds ? Math.max(1, Math.round(info.seconds / 60)) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + space(2) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>{canGenerate ? 'Cancel' : 'Done'}</Text>
        </Pressable>
        <Text style={styles.kicker}>YOUTUBE</Text>
        <Pressable onPress={() => Linking.openURL(source.url)} hitSlop={16}>
          <Text style={styles.open}>Open ↗</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(8) }]} keyboardShouldPersistTaps="handled">
        <View style={styles.frame}>
          <Player videoId={info.videoId} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {state === 'loading' ? (
          <View style={styles.status}>
            <Mascot mood="thinking" size={44} />
            <Text style={styles.statusText}>Asking YouTube for the captions…</Text>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {state === 'ready' ? (
          <Animated.View entering={FadeIn.duration(260)}>
            <View style={styles.status}>
              <Mascot mood="happy" size={44} />
              <Text style={styles.statusText}>
                Got the captions{minutes ? ` - about ${minutes} min of talk` : ''}
                {info.auto ? ' (auto-generated, so expect a few odd words)' : ''}.
              </Text>
            </View>
            <PrimaryButton
              label="Make cards from this video"
              onPress={() => onMakeCards({ kind: 'text', text: info.transcript, name: title, source })}
              style={{ marginTop: space(4) }}
            />
          </Animated.View>
        ) : null}

        {state === 'fallback' ? (
          <Animated.View entering={FadeIn.duration(260)}>
            <View style={styles.status}>
              <Mascot mood="oops" size={44} />
              <Text style={styles.statusText}>
                {error
                  ? error
                  : info.reason === 'no_captions'
                    ? "This video has no captions, so there's nothing to read."
                    : "YouTube wouldn't hand over the captions for this one. It happens a lot."}
              </Text>
            </View>
            <View style={styles.how}>
              <Text style={styles.howTitle}>Thirty-second workaround</Text>
              <Text style={styles.howStep}>1. Open the video in YouTube (the ↗ above).</Text>
              <Text style={styles.howStep}>2. Under the video, tap the ⋯ menu → Show transcript.</Text>
              <Text style={styles.howStep}>3. Select all of it, copy, and paste below.</Text>
            </View>
            <TextInput
              style={styles.paste}
              value={pasted}
              onChangeText={setPasted}
              multiline
              placeholder="Paste the transcript here"
              placeholderTextColor={colors.textFaint}
            />
            <PrimaryButton
              label={pasted.trim().length >= 40 ? 'Make cards from this' : 'Paste the transcript first'}
              variant={pasted.trim().length >= 40 ? 'accent' : 'solid'}
              onPress={() =>
                pasted.trim().length >= 40 && onMakeCards({ kind: 'text', text: pasted.trim(), name: title, source })
              }
              style={{ marginTop: space(3) }}
            />
          </Animated.View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Player({ videoId }) {
  const src = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
  if (Platform.OS === 'web') {
    const { unstable_createElement } = require('react-native-web');
    return unstable_createElement('iframe', {
      src,
      title: 'YouTube',
      allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      style: { border: 0, width: '100%', height: '100%', background: '#000' },
    });
  }
  const { WebView } = require('react-native-webview');
  return (
    <WebView
      source={{ uri: src }}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      style={{ backgroundColor: '#000' }}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingBottom: space(3),
  },
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 64 },
  kicker: { ...type.mono, color: colors.textDim },
  open: { ...type.body, fontWeight: '700', color: colors.accent, width: 64, textAlign: 'right' },
  body: { paddingHorizontal: space(6) },
  frame: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.line,
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  title: { ...type.body, fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space(4) },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(5) },
  statusText: { ...type.body, fontSize: 14, color: colors.textDim, flex: 1 },
  how: {
    marginTop: space(5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
  },
  howTitle: { ...type.body, fontWeight: '700', color: colors.text, marginBottom: space(2) },
  howStep: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(1) },
  paste: {
    ...type.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    padding: space(4),
    minHeight: 140,
    textAlignVertical: 'top',
    marginTop: space(4),
  },
});
