import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../theme';

// One field, one name. New notebook, rename notebook - the same sheet as
// RenameSheet minus the subject line, so it looks like it belongs.
//
//   heading   "New notebook" / "Rename"
//   initial   the current name, if any
//   onSave(name)
export default function NameSheet({ visible, heading = 'Name', initial = '', placeholder = 'Name', onSave, onClose }) {
  const [name, setName] = useState(initial);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setName(initial || '');
  }, [visible, initial]);

  const save = () => {
    const t = name.trim();
    if (!t) return;
    onSave(t);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.heading}>{heading}</Text>
          <Pressable onPress={save} hitSlop={16} disabled={!name.trim()}>
            <Text style={[styles.save, !name.trim() && { color: colors.textFaint }]}>Save</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={save}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            maxLength={80}
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
  label: { ...type.mono, color: colors.textFaint, marginBottom: space(2) },
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
