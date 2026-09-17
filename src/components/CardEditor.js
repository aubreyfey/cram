import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import PrimaryButton from './PrimaryButton';
import { colors, radius, space, type } from '../theme';
import { alert } from '../lib/alert';

// The model gets a card wrong now and then - a misread number, a hint that
// gives the answer away. Without this the only fix is deleting the whole deck,
// which is what people do, right after leaving a one-star review.
export default function CardEditor({ card, visible, onSave, onDelete, onClose }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!card) return;
    setFront(card.front);
    setBack(card.back);
    setHint(card.hint || '');
  }, [card?.id, visible]);

  const save = () => {
    if (!front.trim() || !back.trim()) {
      alert('Both sides needed', 'A card needs a question and an answer.');
      return;
    }
    onSave({ ...card, front: front.trim(), back: back.trim(), hint: hint.trim() || null });
    onClose();
  };

  const remove = () => {
    alert('Delete this card?', "It won't come back.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete(card);
          onClose();
        },
      },
    ]);
  };

  if (!card) return null;

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
          <Text style={styles.title}>Edit card</Text>
          <Pressable onPress={save} hitSlop={16}>
            <Text style={styles.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>QUESTION</Text>
          <TextInput
            style={[styles.input, styles.inputTall]}
            value={front}
            onChangeText={setFront}
            multiline
            autoFocus
            placeholder="What does the card ask?"
            placeholderTextColor={colors.textFaint}
          />

          <Text style={styles.label}>ANSWER</Text>
          <TextInput
            style={[styles.input, styles.inputTall]}
            value={back}
            onChangeText={setBack}
            multiline
            placeholder="One or two sentences"
            placeholderTextColor={colors.textFaint}
          />

          <Text style={styles.label}>HINT (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={hint}
            onChangeText={setHint}
            placeholder="A nudge, not the answer"
            placeholderTextColor={colors.textFaint}
          />

          <PrimaryButton
            label="Delete card"
            variant="ghost"
            onPress={remove}
            style={[styles.delete, { marginBottom: insets.bottom + space(6) }]}
          />
        </ScrollView>
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
  title: { ...type.body, fontWeight: '700', color: colors.text },
  cancel: { ...type.body, fontWeight: '600', color: colors.textDim },
  save: { ...type.body, fontWeight: '700', color: colors.accent },
  body: { padding: space(6) },
  label: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginTop: space(5) },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
  },
  inputTall: { minHeight: 96, textAlignVertical: 'top' },
  delete: { marginTop: space(10), borderColor: colors.again + '66' },
});
