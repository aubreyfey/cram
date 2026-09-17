import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import PrimaryButton from '../components/PrimaryButton';
import { makeManualDeck, parseCards } from '../lib/parseCards';
import { colors, radius, space, type } from '../theme';

// The free path. No model, no server, no quota: type cards, or paste notes
// or a deck a friend shared and let the parser split them. One student
// scans, five paste - that is how a deck spreads through a class.
const blank = () => ({ key: String(Math.random()), front: '', back: '' });

export default function DeckEditorScreen({ onSave, onClose, initialText = '' }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([blank(), blank(), blank()]);
  const [pasteOpen, setPasteOpen] = useState(!!initialText);
  const [pasteText, setPasteText] = useState(initialText);

  const parsed = useMemo(() => parseCards(pasteText), [pasteText]);
  const filled = rows.filter((r) => r.front.trim() && r.back.trim());

  const update = (key, field, value) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const remove = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  };

  const addRow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRows((rs) => [...rs, blank()]);
  };

  const usePasted = () => {
    if (!parsed.length) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Pasted cards replace empty rows and sit after any typed ones.
    setRows((rs) => [
      ...rs.filter((r) => r.front.trim() || r.back.trim()),
      ...parsed.map((c) => ({ ...blank(), ...c })),
    ]);
    // A shared deck's first line is its title; borrow it if none typed.
    if (!title.trim()) {
      const first = pasteText.split('\n')[0]?.trim();
      if (first && !/^(\d+[.)]\s*)?(q|a)\s*:/i.test(first) && first.length < 60) {
        setTitle(first.replace(/\s+-\s+.*$/, ''));
      }
    }
    setPasteText('');
    setPasteOpen(false);
  };

  const save = () => {
    if (!filled.length) {
      Alert.alert('Nothing to save yet', 'Add at least one card with both sides filled in.');
      return;
    }
    const half = rows.length - filled.length - rows.filter((r) => !r.front.trim() && !r.back.trim()).length;
    const go = () => onSave(makeManualDeck({ title, cards: filled }));
    if (half > 0) {
      Alert.alert(
        `${half} ${half === 1 ? 'card is' : 'cards are'} half done`,
        "They'll be left out. Save anyway?",
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Save', onPress: go },
        ],
      );
      return;
    }
    go();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + space(2) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
        <Text style={styles.counter}>
          {filled.length} {filled.length === 1 ? 'CARD' : 'CARDS'}
        </Text>
        <Pressable onPress={() => setPasteOpen((o) => !o)} hitSlop={16}>
          <Text style={styles.paste}>{pasteOpen ? 'Type' : 'Paste'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: space(6) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={setTitle}
          placeholder="Deck name"
          placeholderTextColor={colors.textFaint}
          returnKeyType="done"
        />

        {pasteOpen ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.pasteBox}>
            <Text style={styles.label}>PASTE NOTES OR A SHARED DECK</Text>
            <TextInput
              style={styles.pasteInput}
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              autoFocus
              placeholder={'Q: What is osmosis?\nA: Water moving across a membrane\n\nor  term - definition, one per line'}
              placeholderTextColor={colors.textFaint}
            />
            <View style={styles.pasteRow}>
              <Text style={styles.found}>
                {pasteText.trim()
                  ? parsed.length
                    ? `${parsed.length} ${parsed.length === 1 ? 'card' : 'cards'} found`
                    : 'No cards found yet - try "term - definition"'
                  : 'Q: / A: lines, tabs, or " - " all work'}
              </Text>
              <PrimaryButton
                label={parsed.length ? `Add ${parsed.length}` : 'Add'}
                variant={parsed.length ? 'accent' : 'solid'}
                onPress={usePasted}
                style={styles.pasteButton}
              />
            </View>
          </Animated.View>
        ) : null}

        {rows.map((r, i) => (
          <Animated.View
            key={r.key}
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(120)}
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardNum}>{i + 1}</Text>
              <Pressable onPress={() => remove(r.key)} hitSlop={12}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={r.front}
              onChangeText={(v) => update(r.key, 'front', v)}
              placeholder="Question"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <TextInput
              style={[styles.input, styles.inputBack]}
              value={r.back}
              onChangeText={(v) => update(r.key, 'back', v)}
              placeholder="Answer"
              placeholderTextColor={colors.textFaint}
              multiline
            />
          </Animated.View>
        ))}

        <Pressable style={styles.add} onPress={addRow}>
          <Text style={styles.addText}>+ Add a card</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton
          label={filled.length ? `Save ${filled.length} ${filled.length === 1 ? 'card' : 'cards'}` : 'Save deck'}
          onPress={save}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(6),
  },
  close: { ...type.body, fontWeight: '700', color: colors.textDim },
  counter: { ...type.mono, color: colors.textDim },
  paste: { ...type.body, fontWeight: '700', color: colors.accent },
  body: { paddingHorizontal: space(6), paddingTop: space(3) },
  title: {
    ...type.title,
    fontSize: 24,
    color: colors.text,
    paddingVertical: space(2),
    marginBottom: space(3),
  },
  label: { ...type.mono, color: colors.textFaint, marginBottom: space(2) },
  pasteBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    padding: space(4),
    marginBottom: space(4),
  },
  pasteInput: {
    ...type.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: space(3),
    minHeight: 140,
    textAlignVertical: 'top',
  },
  pasteRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3) },
  found: { ...type.body, fontSize: 13, color: colors.textDim, flex: 1 },
  pasteButton: { height: 44, paddingHorizontal: space(5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    marginBottom: space(3),
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNum: { ...type.mono, color: colors.accent },
  remove: { ...type.body, color: colors.textFaint, fontWeight: '700' },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    marginTop: space(3),
    minHeight: 48,
    textAlignVertical: 'top',
  },
  inputBack: { color: colors.textDim },
  add: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space(1),
  },
  addText: { ...type.body, fontWeight: '700', color: colors.accent },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
