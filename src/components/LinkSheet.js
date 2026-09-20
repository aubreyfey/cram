import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import PrimaryButton from './PrimaryButton';
import { youtubeId } from '../lib/api';
import { colors, radius, space, type } from '../theme';

// One field for a YouTube link. Validated as you type so the button only
// lights up when there is a video behind it.
export default function LinkSheet({ visible, onSubmit, onClose }) {
  const [url, setUrl] = useState('');
  const insets = useSafeAreaInsets();
  const id = youtubeId(url);

  useEffect(() => {
    if (!visible) setUrl('');
  }, [visible]);

  const go = () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit({ url: url.trim(), videoId: id });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.heading}>YouTube video</Text>
          <View style={{ width: 56 }} />
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>PASTE THE LINK</Text>
          <TextInput
            style={[styles.input, id && styles.inputOk]}
            value={url}
            onChangeText={setUrl}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={go}
            placeholder="https://youtu.be/…"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.hint}>
            {url.trim() && !id
              ? "That doesn't look like a YouTube link yet."
              : 'A lecture, a crash course, a tutorial - anything with captions.'}
          </Text>
          <PrimaryButton
            label="Open it"
            variant={id ? 'accent' : 'solid'}
            onPress={go}
            style={{ marginTop: space(6) }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingBottom: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  heading: { ...type.body, fontWeight: '700', color: colors.text },
  cancel: { ...type.body, fontWeight: '600', color: colors.textDim, width: 56 },
  body: { padding: space(6) },
  label: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginTop: space(3) },
  input: {
    ...type.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
  },
  inputOk: { borderColor: colors.accent },
  hint: { ...type.body, fontSize: 13, color: colors.textFaint, marginTop: space(2) },
});
