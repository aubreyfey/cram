import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import PrimaryButton from './PrimaryButton';
import * as account from '../lib/account';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// Email, then a 6-digit code. No password to forget. Used by Settings (to
// turn on cloud backup) and by the board (to post and vote); both end up
// with the same session.
//
//   sub    the one line under the title, before the code is sent
//   via    { signIn, verifyCode } - defaults to the account; the board
//          passes its own so the on-device demo board still works
//   demo   show the "any email, any code" hint
export default function SignInSheet({ visible, onClose, onSignedIn, sub, via = account, demo = false }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      setSent(false);
      setCode('');
    }
  }, [visible]);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e) || busy) return;
    setBusy(true);
    try {
      await via.signIn(e);
      setSent(true);
    } catch (err) {
      alert("Couldn't send the code", err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const s = await via.verifyCode(email.trim().toLowerCase(), code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSignedIn(s);
    } catch (err) {
      alert("Didn't work", err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHead, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>Sign in</Text>
          <View style={{ width: 56 }} />
        </View>
        <View style={styles.sheetBody}>
          <Text style={styles.signTitle}>{sent ? 'Check your email' : 'Email, then a code'}</Text>
          <Text style={styles.signSub}>
            {sent
              ? `We sent a 6-digit code to ${email.trim()}. Type it here.`
              : sub || 'No password. We email you a code, you type it, done.'}
          </Text>
          {!sent ? (
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={send}
              placeholder="you@school.edu"
              placeholderTextColor={colors.textFaint}
            />
          ) : (
            <TextInput
              style={[styles.input, styles.code]}
              value={code}
              onChangeText={setCode}
              autoFocus
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={verify}
              maxLength={8}
              placeholder="123456"
              placeholderTextColor={colors.textFaint}
            />
          )}
          {demo ? <Text style={styles.hint}>Demo: any email, any code.</Text> : null}
        </View>
        <View style={[styles.sheetFoot, { paddingBottom: insets.bottom + space(4) }]}>
          <PrimaryButton
            label={busy ? 'One moment…' : sent ? 'Sign in' : 'Send me a code'}
            onPress={sent ? verify : send}
          />
          {sent ? (
            <Pressable onPress={() => setSent(false)} style={{ alignSelf: 'center', marginTop: space(3) }} hitSlop={8}>
              <Text style={styles.wrong}>Wrong email?</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingBottom: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sheetTitle: { ...type.body, fontWeight: '700', color: colors.text },
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56 },
  sheetBody: { padding: space(6) },
  sheetFoot: { paddingHorizontal: space(6), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  signTitle: { ...type.title, fontSize: 24, color: colors.text },
  signSub: { ...type.body, color: colors.textDim, marginTop: space(2) },
  input: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    marginTop: space(4),
  },
  code: { letterSpacing: 6, textAlign: 'center', fontSize: 24, fontWeight: '800' },
  hint: { ...type.body, fontSize: 13, color: colors.textFaint, marginTop: space(3) },
  wrong: { ...type.body, fontSize: 13, color: colors.textFaint },
});
