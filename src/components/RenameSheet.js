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
import { colors, radius, space, type } from '../theme';

// The model names decks from the content, which is usually right and
// sometimes "Untitled deck" or "Lecture 4 slides". Two fields, no ceremony.
export default function RenameSheet({ deck, visible, onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!deck) return;
    setTitle(deck.title || '');
    setSubject(deck.subject || '');
  }, [deck?.id, visible]);

  const save = () => {
    const t = title.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave({ ...deck, title: t, subject: subject.trim() || null });
    onClose();
  };

  if (!deck) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.heading}>Rename</Text>
          <Pressable onPress={save} hitSlop={16} disabled={!title.trim()}>
            <Text style={[styles.save, !title.trim() && { color: colors.textFaint }]}>Save</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            autoFocus
            selectTextOnFocus
            returnKeyType="next"
            placeholder="Deck name"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.label}>SUBJECT (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="done"
            onSubmitEditing={save}
            placeholder="Organic Chemistry"
            placeholderTextColor={colors.textFaint}
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
  cancel: { ...type.body, fontWeight: '600', color: colors.textDim },
  save: { ...type.body, fontWeight: '700', color: colors.accent },
  body: { padding: space(6) },
  label: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginTop: space(5) },
  input: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
  },
});
