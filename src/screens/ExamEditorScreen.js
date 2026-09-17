import React, { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import PrimaryButton from '../components/PrimaryButton';
import { addDays, countdown, prettyDate, today } from '../lib/exams';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// Name it, date it, tick the decks. No date picker widget: a few chips for
// the usual cases and a day stepper for everything else is faster than
// scrolling a wheel, and it works the same on every platform.
const QUICK = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];

export default function ExamEditorScreen({ exam, decks, onSave, onDelete, onClose }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(exam?.title ?? '');
  const [date, setDate] = useState(exam?.date ?? addDays(today(), 7));
  const [deckIds, setDeckIds] = useState(new Set(exam?.deckIds ?? []));

  const toggle = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeckIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const step = (n) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDate((d) => {
      const next = addDays(d, n);
      return next < today() ? today() : next;
    });
  };

  const save = () => {
    if (!title.trim()) {
      alert('Give it a name', '"Chem final", "Bio midterm" - whatever you call it.');
      return;
    }
    onSave({
      id: exam?.id ?? `exam_${Date.now()}`,
      title: title.trim(),
      date,
      deckIds: [...deckIds],
      createdAt: exam?.createdAt ?? Date.now(),
    });
  };

  const remove = () => {
    alert('Remove this exam?', 'The decks stay. Only the countdown goes.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(exam.id) },
    ]);
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
        <Text style={styles.counter}>{exam ? 'EDIT EXAM' : 'NEW EXAM'}</Text>
        {exam ? (
          <Pressable onPress={remove} hitSlop={16}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={setTitle}
          placeholder="Chem final"
          placeholderTextColor={colors.textFaint}
          autoFocus={!exam}
          returnKeyType="done"
        />

        <Text style={styles.label}>WHEN</Text>
        <View style={styles.dateRow}>
          <Pressable onPress={() => step(-1)} style={styles.stepper} hitSlop={8}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.dateBig}>{prettyDate(date)}</Text>
            <Text style={styles.dateSub}>{countdown(date)}</Text>
          </View>
          <Pressable onPress={() => step(1)} style={styles.stepper} hitSlop={8}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {QUICK.map((q) => {
            const key = addDays(today(), q.days);
            const active = key === date;
            return (
              <Pressable
                key={q.label}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDate(key);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{q.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>DECKS FOR THIS EXAM</Text>
        {decks.length ? (
          <View style={styles.list}>
            {decks.map((d) => {
              const on = deckIds.has(d.id);
              return (
                <Pressable key={d.id} onPress={() => toggle(d.id)} style={styles.row}>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Text style={styles.tick}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.rowSub}>{d.cards.length} cards</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>No decks yet. Add the exam now and link decks as you make them.</Text>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(4) }]}>
        <PrimaryButton label={exam ? 'Save' : 'Add exam'} onPress={save} />
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
  remove: { ...type.body, fontWeight: '700', color: colors.again },
  body: { paddingHorizontal: space(6), paddingTop: space(3), paddingBottom: space(8) },
  title: { ...type.title, fontSize: 26, color: colors.text, paddingVertical: space(2) },
  label: { ...type.mono, color: colors.textFaint, marginTop: space(7), marginBottom: space(3) },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(3),
  },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: -2 },
  dateBig: { ...type.body, fontSize: 18, fontWeight: '800', color: colors.text },
  dateSub: { ...type.mono, color: colors.accent, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  chip: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...type.label, fontSize: 12, color: colors.textDim },
  chipTextActive: { color: colors.accentInk },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.accentInk, fontWeight: '800', fontSize: 14 },
  rowTitle: { ...type.body, fontWeight: '600', color: colors.text },
  rowSub: { ...type.body, fontSize: 13, color: colors.textDim },
  empty: { ...type.body, fontSize: 14, color: colors.textDim },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
