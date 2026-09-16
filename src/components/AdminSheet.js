import React, { useState } from 'react';
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
import { enableAdmin } from '../lib/entitlements';
import { colors, radius, space, type } from '../theme';

// Reached by tapping the wordmark five times. Deliberately plain - it is for
// the two people who run the app, not a feature anyone is meant to find.
export default function AdminSheet({ visible, onClose, onEnabled }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await enableAdmin(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode('');
      onEnabled();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={close} hitSlop={16}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>ADMIN</Text>
          <Text style={styles.title}>Enter the admin code</Text>
          <Text style={styles.sub}>
            Unlimited scans on this device, no paywall. The code is the server's CRAM_ADMIN_KEY.
          </Text>

          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setError(null);
            }}
            onSubmitEditing={submit}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            returnKeyType="go"
            placeholder="Code"
            placeholderTextColor={colors.textFaint}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            label={busy ? 'Checking…' : 'Turn on admin'}
            onPress={submit}
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
    justifyContent: 'flex-end',
    paddingHorizontal: space(6),
    paddingBottom: space(2),
  },
  cancel: { ...type.body, fontWeight: '600', color: colors.textDim },
  body: { padding: space(6), paddingTop: space(8) },
  kicker: { ...type.mono, color: colors.accent },
  title: { ...type.title, color: colors.text, marginTop: space(2) },
  sub: { ...type.body, color: colors.textDim, marginTop: space(3) },
  input: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    marginTop: space(8),
  },
  inputError: { borderColor: colors.again },
  error: { ...type.body, fontSize: 14, color: colors.again, marginTop: space(2) },
});
