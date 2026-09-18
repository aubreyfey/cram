import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, space, type } from '../theme';

// Read the PDF before (or instead of) turning it into cards. iOS renders
// PDFs natively in a WebView; the browser does it in an iframe; Android's
// WebView can't, so it gets a hand-off to whatever viewer is installed.
//
// Two jobs: previewing a document you're about to scan (with "Make cards"
// underneath), and re-opening the PDF a deck was made from (no button).
export default function DocumentScreen({ source, onMakeCards, onClose, ctaLabel = 'Make cards' }) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const name = source?.name || 'Document';

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>{onMakeCards ? 'Cancel' : 'Done'}</Text>
        </Pressable>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.frame}>
        <Viewer uri={source?.uri} name={name} onFail={() => setFailed(true)} failed={failed} />
      </View>

      {onMakeCards ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
          <PrimaryButton label={ctaLabel} onPress={onMakeCards} />
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  );
}

function Viewer({ uri, name, failed, onFail }) {
  if (!uri) return <Fallback name={name} reason="Nothing to show." />;

  if (Platform.OS === 'web') {
    // react-native-web can render a raw DOM element; an iframe is the
    // browser's own PDF viewer, which is better than anything we'd draw.
    const { unstable_createElement } = require('react-native-web');
    return unstable_createElement('iframe', {
      src: uri,
      title: name,
      style: { border: 0, width: '100%', height: '100%', background: colors.surface },
    });
  }

  if (Platform.OS === 'android' || failed) {
    return (
      <Fallback
        name={name}
        reason={failed ? "Couldn't render this one here." : 'Android previews open in your PDF app.'}
        uri={uri}
      />
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <WebView
      source={{ uri }}
      originWhitelist={['*']}
      allowingReadAccessToURL={uri}
      allowFileAccess
      style={{ backgroundColor: colors.surface }}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      onError={onFail}
    />
  );
}

function Fallback({ name, reason, uri }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.glyph}>▤</Text>
      <Text style={styles.fallbackName} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.fallbackReason}>{reason}</Text>
      {uri ? (
        <PrimaryButton
          label="Open in another app"
          variant="ghost"
          onPress={() => Linking.openURL(uri).catch(() => {})}
          style={{ marginTop: space(6) }}
        />
      ) : null}
    </View>
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
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56 },
  name: { ...type.body, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  frame: {
    flex: 1,
    marginHorizontal: space(4),
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(8) },
  glyph: { fontSize: 56, color: colors.accent },
  fallbackName: { ...type.body, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: space(4) },
  fallbackReason: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center', marginTop: space(2) },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
