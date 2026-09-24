import React, { useEffect, useRef, useState } from 'react';
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
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import PrimaryButton from '../components/PrimaryButton';
import { fmt, timeLabel } from '../components/NoteFeed';
import NoteImage from '../components/NoteImage';
import PhotoViewer from '../components/PhotoViewer';
import { MAX_IMAGES, deleteFiles, fileUri, importAudio, importImage, isEmptyNote } from '../lib/notes';
import { useLayout } from '../lib/layout';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// The native date picker has no web build; load it only where it exists.
const DatePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');

// The editor. Photos first - full width, swipe between them - then the
// words underneath, then the quiet rows: when, where, a recording. Save
// is the only ceremony. Everything else is a tap.
//
//   note        the note to edit (a fresh one from makeNote for "new")
//   notebook    for the kicker
//   onSave(note) / onDelete(note) / onClose()
//   onMakeCards(note)  study-first: the words or the photos, into cards
const MAX_RECORD = 10 * 60;

export default function NoteEditorScreen({ note, notebook, notebooks = [], isNew, onSave, onDelete, onClose, onMakeCards, onSwitchNotebook }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useLayout();
  const [draft, setDraft] = useState(note);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  // Files this session brought in, so Cancel can throw them away; files
  // the user removed, so Save can.
  const imported = useRef([]);
  const removed = useRef([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(note);
  const empty = isEmptyNote(draft);
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  // Expanded: the photo gets the screen and the words step out of the way,
  // for reading a board shot back. Shrinks again on the same button.
  const [expanded, setExpanded] = useState(false);

  // A wide column, not the whole pane, on an iPad.
  const pageW = Math.min(width, 640);
  const photoH = expanded ? Math.max(pageW * 0.92, height - insets.top - insets.bottom - 200) : pageW * 0.92;

  // --- photos --------------------------------------------------------------
  const addImages = async (uris) => {
    const room = MAX_IMAGES - (draft.images?.length || 0);
    if (room <= 0) return alert('That is plenty', `${MAX_IMAGES} photos is the limit for one note.`);
    setBusy(true);
    try {
      const added = [];
      for (const uri of uris.slice(0, room)) {
        const img = await importImage(uri);
        added.push(img);
        imported.current.push(img.file);
      }
      setDraft((d) => ({ ...d, images: [...(d.images || []), ...added] }));
    } catch (e) {
      alert("Couldn't add that photo", e.message);
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return alert('Photos are off', 'Allow photo access for Cram to add one.');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: MAX_IMAGES, orderedSelection: true });
    if (r.canceled || !r.assets?.length) return;
    await addImages(r.assets.map((a) => a.uri));
  };

  const fromCamera = async () => {
    if (Platform.OS === 'web') return fromLibrary();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return alert('Camera is off', 'Allow the camera for Cram to take a photo.');
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (r.canceled || !r.assets?.length) return;
    await addImages([r.assets[0].uri]);
  };

  const removeImage = (i) => {
    const img = draft.images[i];
    if (img.file) removed.current.push(img.file);
    patch({ images: draft.images.filter((_, j) => j !== i) });
    setPage((p) => Math.max(0, Math.min(p, draft.images.length - 2)));
  };

  // Two buttons, not a menu: the camera exists on a phone, not in a browser.
  const canShoot = Platform.OS !== 'web';
  const [viewing, setViewing] = useState(null);
  // When and where stay folded away until the line under the title is
  // tapped - most notes are right now, right here.
  const [meta, setMeta] = useState(false);

  const canSwitch = !!onSwitchNotebook && notebooks.filter((b) => !b.archived).length > 1;
  const pickNotebook = () => {
    if (!canSwitch) return;
    const others = notebooks.filter((b) => !b.archived && b.id !== draft.notebookId).slice(0, 8);
    alert('Move to', null, [
      ...others.map((b) => ({ text: b.title, onPress: () => { patch({ notebookId: b.id }); onSwitchNotebook(b); } })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // --- audio ---------------------------------------------------------------
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);
  const tick = useRef(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const startRecording = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return alert('Microphone is off', 'Allow the microphone for Cram to record.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setSeconds(0);
    setRecording(true);
    tick.current = setInterval(() => {
      const s = Math.round((Date.now() - startedAt.current) / 1000);
      setSeconds(s);
      if (s >= MAX_RECORD) stopRecording();
    }, 500);
  };

  const stopRecording = async () => {
    clearInterval(tick.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    setRecording(false);
    if (!recorder.uri) return;
    try {
      const audio = await importAudio(recorder.uri, duration);
      if (audio.file) imported.current.push(audio.file);
      if (draft.audio?.file) removed.current.push(draft.audio.file);
      patch({ audio });
    } catch (e) {
      alert("Couldn't keep that recording", e.message);
    }
  };

  const togglePlay = () => {
    const uri = fileUri(draft.audio);
    if (!uri) return alert('Recorded on another phone', 'The audio stayed there.');
    if (status.playing) return player.pause();
    if (!status.isLoaded || status.didJustFinish) player.replace({ uri });
    if (status.didJustFinish) player.seekTo(0);
    player.play();
  };

  const removeAudio = () => {
    player.pause();
    if (draft.audio?.file) removed.current.push(draft.audio.file);
    patch({ audio: null });
  };

  useEffect(() => () => clearInterval(tick.current), []);

  // --- save / cancel -------------------------------------------------------
  const save = () => {
    if (empty) return cancel(true);
    deleteFiles(removed.current);
    onSave(draft);
  };

  const cancel = (silent = false) => {
    const go = () => {
      deleteFiles(imported.current);
      onClose();
    };
    if (silent || !dirty || (isNew && empty)) return go();
    alert('Discard changes?', null, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: go },
    ]);
  };

  const confirmDelete = () =>
    alert('Delete note?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(note) },
    ]);

  const canMakeCards = (draft.text || '').trim().length >= 40 || (draft.images?.length || 0) > 0;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PhotoViewer images={draft.images || []} index={viewing ?? 0} visible={viewing != null} onClose={() => setViewing(null)} />

      {/* Where the note lives and when it happened, both editable here:
          the notebook by name, the rest by tapping the line under it. */}
      <View style={[styles.header, { paddingTop: insets.top + space(2) }]}>
        <Pressable onPress={() => cancel()} style={styles.round} hitSlop={10}>
          <Text style={styles.roundGlyph}>←</Text>
        </Pressable>
        <View style={styles.headMid}>
          <Pressable onPress={pickNotebook} hitSlop={8}>
            <Text style={styles.headTitle} numberOfLines={1}>
              {notebook?.title || 'Note'}
              {canSwitch ? ' ⌄' : ''}
            </Text>
          </Pressable>
          <Pressable onPress={() => setMeta((m) => !m)} hitSlop={8}>
            <Text style={styles.headMeta} numberOfLines={1}>
              {timeLabel(draft.at).toLowerCase()} · {draft.place || 'add a place'}
            </Text>
          </Pressable>
        </View>
        {draft.images?.length ? (
          <Pressable onPress={() => setExpanded((x) => !x)} style={[styles.round, expanded && styles.roundGo]} hitSlop={10}>
            <Text style={[styles.roundGlyph, expanded && { color: colors.accentInk }]}>{expanded ? '⤡' : '⤢'}</Text>
          </Pressable>
        ) : (
          <View style={styles.round} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space(32) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {meta && !expanded ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.metaBox}>
            <Row label="WHEN">
              <When at={draft.at} onChange={(at) => patch({ at })} />
            </Row>
            <Row label="WHERE">
              <TextInput
                style={styles.rowInput}
                value={draft.place}
                onChangeText={(t) => patch({ place: t })}
                placeholder="A library, a café, room 204"
                placeholderTextColor={colors.textFaint}
                maxLength={80}
              />
            </Row>
          </Animated.View>
        ) : null}

        {draft.images?.length ? (
          <View style={styles.stage}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageW))}
            >
              {draft.images.map((img, i) => (
                <Pressable key={img.file || img.uri || i} onPress={() => setViewing(i)} style={{ width: pageW, height: photoH }}>
                  <NoteImage image={img} style={styles.slide} resizeMode={expanded ? 'contain' : 'cover'} />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterText}>
                {page + 1} / {draft.images.length}
              </Text>
            </View>
            <View style={styles.stageActions}>
              <Pressable onPress={() => removeImage(page)} style={styles.stageButton} hitSlop={8}>
                <Text style={styles.stageGlyph}>✕</Text>
              </Pressable>
              <Pressable onPress={fromLibrary} style={styles.stageButton} hitSlop={8} disabled={busy}>
                <Text style={styles.stageGlyph}>▤</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.dropzone, { height: pageW * 0.42 }]}>
            <Text style={styles.dropGlyph}>▣</Text>
            <Text style={styles.dropText}>{busy ? 'Adding…' : 'A photo of the board, a diagram, a page'}</Text>
            <View style={styles.dropButtons}>
              {canShoot ? (
                <Pressable onPress={fromCamera} style={styles.dropButton} disabled={busy}>
                  <Text style={styles.dropButtonText}>Take a photo</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={fromLibrary} style={[styles.dropButton, styles.dropButtonOn]} disabled={busy}>
                <Text style={[styles.dropButtonText, { color: colors.accentInk }]}>{canShoot ? 'From photos' : 'Choose a photo'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.body, expanded && styles.hidden]} pointerEvents={expanded ? 'none' : 'auto'}>
          <TextInput
            style={styles.title}
            value={draft.title}
            onChangeText={(t) => patch({ title: t })}
            placeholder="Title"
            placeholderTextColor={colors.textFaint}
            maxLength={80}
            returnKeyType="next"
          />
          <TextInput
            style={styles.text}
            value={draft.text}
            onChangeText={(t) => patch({ text: t })}
            placeholder="What it says, in your own words. Why it works. What you'd get wrong."
            placeholderTextColor={colors.textFaint}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
          />

          {onMakeCards && canMakeCards ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <PrimaryButton label="Make cards from this" variant="solid" onPress={() => onMakeCards(draft)} style={{ marginTop: space(6) }} />
              <Text style={styles.makeHint}>
                {(draft.text || '').trim().length >= 40 ? 'From what you wrote' : 'Reads the photos, like a scan'}
                {(draft.text || '').trim().length >= 40 && draft.images?.length ? ' - or the photos, if you clear the text' : ''}
              </Text>
            </Animated.View>
          ) : null}

          {!isNew ? (
            <Pressable onPress={confirmDelete} style={styles.deleteRow} hitSlop={8}>
              <Text style={styles.deleteText}>Delete note</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Say it, take it, keep it. Always there, so a note is three taps
          from nothing. */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + space(3) }]}>
        <Text style={styles.audioLine} numberOfLines={1}>
          {recording ? `recording ${fmt(seconds)}` : draft.audio ? `${fmt(draft.audio.duration)} recording` : 'no audio yet'}
        </Text>
        <View style={styles.barRow}>
          {draft.audio && !recording ? (
            <View style={styles.barLeft}>
              <Pressable onPress={togglePlay} style={styles.round} hitSlop={10}>
                <Text style={styles.roundGlyph}>{status.playing ? '❚❚' : '▶'}</Text>
              </Pressable>
              <Pressable onPress={removeAudio} hitSlop={10}>
                <Text style={styles.barRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={recording ? stopRecording : startRecording}
              style={[styles.round, recording && styles.roundHot]}
              hitSlop={10}
              disabled={Platform.OS === 'web'}
            >
              <Text style={[styles.roundGlyph, Platform.OS === 'web' && { color: colors.textFaint }]}>{recording ? '■' : '●'}</Text>
            </Pressable>
          )}

          <Pressable onPress={canShoot ? fromCamera : fromLibrary} style={styles.shutter} disabled={busy}>
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable onPress={save} style={[styles.round, !empty && styles.roundGo]} hitSlop={10} disabled={busy}>
            <Text style={[styles.roundGlyph, !empty && { color: colors.accentInk }]}>✓</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


function Row({ label, children }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// When the note is about. iOS: the compact inline picker. Android: the
// system dialogs, date then time. Web: read-only.
function When({ at, onChange }) {
  if (Platform.OS === 'ios' && DatePicker) {
    const Picker = DatePicker.default;
    return (
      <Picker
        value={new Date(at)}
        mode="datetime"
        display="compact"
        themeVariant="dark"
        accentColor={colors.accent}
        onChange={(_e, d) => d && onChange(d.getTime())}
        style={{ alignSelf: 'flex-start', marginLeft: -space(2) }}
      />
    );
  }
  const label = `${new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${timeLabel(at)}`;
  if (Platform.OS === 'android' && DatePicker) {
    const open = () =>
      DatePicker.DateTimePickerAndroid.open({
        value: new Date(at),
        mode: 'date',
        onChange: (e, d) => {
          if (e.type !== 'set' || !d) return;
          DatePicker.DateTimePickerAndroid.open({
            value: d,
            mode: 'time',
            onChange: (e2, t) => e2.type === 'set' && t && onChange(t.getTime()),
          });
        },
      });
    return (
      <Pressable onPress={open} hitSlop={8}>
        <Text style={styles.rowAction}>{label}</Text>
      </Pressable>
    );
  }
  return <Text style={styles.rowValue}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingBottom: space(3),
    gap: space(3),
  },
  headMid: { flex: 1, alignItems: 'center', gap: 1 },
  headTitle: { ...type.body, fontSize: 17, fontWeight: '700', color: colors.text },
  headMeta: { ...type.mono, fontSize: 10, color: colors.textFaint },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  roundGlyph: { fontSize: 16, color: colors.text },
  roundGo: { backgroundColor: colors.accent, borderColor: colors.accent },
  roundHot: { backgroundColor: colors.again, borderColor: colors.again },
  metaBox: { paddingHorizontal: space(6), paddingBottom: space(2) },
  stage: { position: 'relative' },
  counter: {
    position: 'absolute',
    left: space(4),
    bottom: space(4),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    backgroundColor: '#000000AA',
  },
  counterText: { ...type.mono, fontSize: 10, color: colors.text },
  stageActions: { position: 'absolute', right: space(4), bottom: space(4), flexDirection: 'row', gap: space(2) },
  stageButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000AA' },
  stageGlyph: { fontSize: 14, color: colors.text },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space(6),
    paddingTop: space(3),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: space(2),
  },
  audioLine: { ...type.mono, fontSize: 10, color: colors.textFaint },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  barRemove: { ...type.body, fontSize: 13, fontWeight: '600', color: colors.textDim },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.text },
  slide: { width: '100%', height: '100%', backgroundColor: colors.surface },
  dropButtons: { flexDirection: 'row', gap: space(2), marginTop: space(2) },
  dropButton: { paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  dropButtonOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dropButtonText: { ...type.label, fontSize: 12, color: colors.text },
  dropzone: {
    marginHorizontal: space(6),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  dropGlyph: { fontSize: 28, color: colors.textFaint },
  dropText: { ...type.body, fontSize: 14, color: colors.textDim },
  body: { paddingHorizontal: space(6), paddingTop: space(5) },
  title: { ...type.card, color: colors.text, paddingVertical: space(2) },
  text: { ...type.body, fontSize: 17, lineHeight: 26, color: colors.text, minHeight: 120, paddingVertical: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 52 },
  rowLabel: { ...type.mono, color: colors.textFaint, width: 56 },
  rowInput: { ...type.body, color: colors.text, paddingVertical: space(1) },
  rowValue: { ...type.body, color: colors.text },
  rowAction: { ...type.body, fontWeight: '600', color: colors.accent },
  makeHint: { ...type.body, fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: space(2) },
  hidden: { height: 0, opacity: 0, overflow: 'hidden', paddingVertical: 0 },
  deleteRow: { alignSelf: 'center', marginTop: space(8) },
  deleteText: { ...type.body, fontWeight: '600', color: colors.again },
});
