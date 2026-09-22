import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as SplashScreen from 'expo-splash-screen';
import ErrorBoundary from './src/components/ErrorBoundary';
import Opening from './src/components/Opening';
import NameAsk from './src/components/NameAsk';
import AdminSheet from './src/components/AdminSheet';
import RenameSheet from './src/components/RenameSheet';
import LinkSheet from './src/components/LinkSheet';
import Screen from './src/components/Screen';
import SourceSheet from './src/components/SourceSheet';
import CameraScreen from './src/screens/CameraScreen';
import GeneratingScreen from './src/screens/GeneratingScreen';
import StudyScreen from './src/screens/StudyScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import DeckEditorScreen from './src/screens/DeckEditorScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import ExamEditorScreen from './src/screens/ExamEditorScreen';
import DocumentScreen from './src/screens/DocumentScreen';
import BoardScreen from './src/screens/BoardScreen';
import ExamScreen from './src/screens/ExamScreen';
import TalkScreen from './src/screens/TalkScreen';
import TalksScreen from './src/screens/TalksScreen';
import VideoScreen from './src/screens/VideoScreen';
import SharedDeckScreen from './src/screens/SharedDeckScreen';
import JournalScreen from './src/screens/JournalScreen';
import NotebooksScreen from './src/screens/NotebooksScreen';
import NotebookScreen from './src/screens/NotebookScreen';
import NoteEditorScreen from './src/screens/NoteEditorScreen';
import StripScreen from './src/screens/StripScreen';
import NameSheet from './src/components/NameSheet';

import { MAX_PAGES, generateDeck, generateGuide } from './src/lib/api';
import { pickDocument, pickFromLibrary } from './src/lib/pickers';
import {
  addUsage,
  deleteDeck,
  getStreak,
  loadDecks,
  deleteExam,
  loadExams,
  saveAllDecks,
  saveCards,
  saveDeck,
  saveExam,
  touchStreak,
} from './src/lib/storage';
import { examDecks, upcoming } from './src/lib/exams';
import { canUseDocuments, checkQuota, disableAdmin, isSubscribed } from './src/lib/entitlements';
import { makeBiologySampleDeck, makeSampleDeck } from './src/lib/sampleDeck';
import { mergeDecks, readDeckFile } from './src/lib/backup';
import { configureNotifications, rearmNag } from './src/lib/reminders';
import { dropSource, keepSource } from './src/lib/sources';
import { deleteFigures } from './src/lib/figures';
import { logJournal } from './src/lib/journal';
import {
  deleteFiles,
  deleteNote,
  deleteNotebook,
  fileUri,
  importImage,
  loadNotebooks,
  loadNotes,
  makeNote,
  makeNotebook,
  saveNote,
  saveNotebook,
} from './src/lib/notes';
import { clearShareUrl, deckFromShared, fetchSharedDeck, parseShareUrl } from './src/lib/shareLink';
import { LIBRARY } from './src/lib/layout';
import { deleteTalk, loadTalks, saveTalk } from './src/lib/talks';
import { migrate } from './src/lib/migrations';
import { onMerged, startCloud, sync as syncCloud } from './src/lib/cloud';
import { getProfile } from './src/lib/profile';
import { initMonitoring, wrapRoot } from './src/lib/monitoring';
import { colors } from './src/theme';

// Before anything renders, so a crash in the first frame is still caught.
initMonitoring();

// Hold the native splash until the opening animation is on screen, so the
// two are one continuous frame instead of splash -> flash -> app.
SplashScreen.preventAutoHideAsync().catch(() => {});
import { alert } from './src/lib/alert';

function App() {
  const [screen, setScreen] = useState('camera');
  const [opening, setOpening] = useState(true);
  const [name, setNameState] = useState('');
  const [askName, setAskName] = useState(false);
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState({ allowed: true, remaining: 10 });
  const [pro, setPro] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  // A document on screen: { source, back } - back is where Done returns to,
  // and whether "Make cards" is offered (only when previewing before a scan).
  const [doc, setDoc] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  // { video: { videoId, url?, title? }, back, canGenerate }
  const [vid, setVid] = useState(null);
  const [streak, setStreak] = useState(0);
  const [exams, setExams] = useState([]);
  const [editingExam, setEditingExam] = useState(null);
  const [viewingExam, setViewingExam] = useState(null);
  const [talks, setTalks] = useState([]);
  // { title?, deckId?, examId?, back } - what a talk is about and where
  // Cancel/Done return to.
  const [talkContext, setTalkContext] = useState(null);
  const [studyMode, setStudyMode] = useState('cards');
  // When set, the next scan's cards are appended to this deck instead of
  // making a new one. A lecture is thirty slides, not thirty decks.
  const [appendTo, setAppendTo] = useState(null);
  // Photos waiting on the review screen. Every capture and every library pick
  // lands here first; a deck is made from all of them at once.
  const [pages, setPages] = useState([]);
  // A deck someone sent by link: { loading } | { error } | { deck }. Set
  // from the URL the app was opened with, on any platform.
  const [shared, setShared] = useState(null);
  const [savingShared, setSavingShared] = useState(false);
  // Notebooks and notes. noteDraft: { note, notebook, isNew, back } while
  // the editor is up; stripCtx: { notes, notebook, back }; naming: which
  // notebook the name sheet is for ({ notebook } to rename, {} for new).
  const [notebooks, setNotebooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeNotebook, setActiveNotebook] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null);
  const [stripCtx, setStripCtx] = useState(null);
  const [naming, setNaming] = useState(null);

  const abortRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeDeck;

  const refresh = useCallback(async () => {
    // Bring stored data up to this version's shape before reading any of it.
    await migrate();
    setDecks(await loadDecks());
    setQuota(await checkQuota());
    setPro(await isSubscribed());
    setStreak((await getStreak()).count);
    setExams(await loadExams());
    setTalks(await loadTalks());
    setNotebooks(await loadNotebooks());
    setNotes(await loadNotes());
    const profile = await getProfile();
    setNameState(profile.name);
    // First launch only: Volt asks for a name once the opening is done.
    if (!profile.name && !profile.asked) setAskName(true);
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    // Cloud backup starts after the first load, so it never snapshots data
    // the migration step has not brought up to date yet.
    refresh().then(startCloud);
    configureNotifications();
    // Opening the app is proof of life: push the missed-study alarm to
    // tomorrow. Also re-arm whenever the app comes back to the foreground.
    rearmNag();
    // Signed in, a merge that changed anything reloads the library.
    const stopMerged = onMerged(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        rearmNag();
        syncCloud();
      }
    });
    return () => {
      sub.remove();
      stopMerged();
    };
  }, [refresh]);

  // Links: <site>/d/<id> on the web, cram://d/<id> in the app. Whatever
  // screen was up gives way to the shared deck; Close returns to camera.
  useEffect(() => {
    const open = async (url) => {
      const id = parseShareUrl(url);
      if (!id) return;
      setShared({ loading: true });
      setScreen('shared');
      try {
        setShared({ deck: await fetchSharedDeck(id) });
      } catch (e) {
        setShared({ error: e.message });
      }
    };
    Linking.getInitialURL()
      .then((u) => u && open(u))
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => sub.remove();
  }, []);

  const saveShared = useCallback(async () => {
    if (!shared?.deck) return;
    setSavingShared(true);
    try {
      const deck = deckFromShared(shared.deck);
      setDecks(await saveDeck(deck));
      setShared(null);
      clearShareUrl();
      setActiveDeck(deck);
      setScreen('study');
    } finally {
      setSavingShared(false);
    }
  }, [shared]);

  const run = useCallback(
    async (src) => {
      setError(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // The tier picks the model server-side: subscribers get the best one,
        // free users get the cheap one. Admin is resolved on the server.
        const fresh = await generateDeck(src, {
          signal: controller.signal,
          tier: (await isSubscribed()) ? 'pro' : 'free',
        });
        if (controller.signal.aborted) return;

        // Appending keeps the original deck's title and schedule; the new
        // cards simply arrive unstudied and are due immediately.
        let deck = appendTo
          ? { ...appendTo, cards: [...appendTo.cards, ...fresh.cards] }
          : fresh;
        // A deck made from a PDF keeps a copy, so it can be opened again; a
        // deck made from a video keeps the link.
        if (src.kind === 'pdf' && !deck.source) {
          const source = await keepSource(deck.id, src);
          if (source) deck = { ...deck, source };
        } else if (src.source && !deck.source) {
          deck = { ...deck, source: src.source };
        }

        setDecks(await saveDeck(deck));
        // Recorded for everyone, not just free users - subscribers don't meter
        // cards, but their scans still cost us money and feed the fair-use check.
        await addUsage(fresh.cards.length);
        logJournal({ scans: 1, cards: fresh.cards.length });
        setQuota(await checkQuota());

        setAppendTo(null);
        setPages([]);
        setActiveDeck(deck);
        setScreen('study');
      } catch (e) {
        if (e.name === 'AbortError') return;
        // The server keeps its own count; treat its wall like our own.
        if (e.code === 'quota') {
          setPaywallReason('quota');
          setScreen('paywall');
          return;
        }
        if (e.code === 'fair_use') {
          alert("That's a lot of scanning", "You've hit today's limit. It resets at midnight - and if you genuinely need more, tell us.");
          setScreen('camera');
          return;
        }
        setError(e);
      }
    },
    [appendTo],
  );

  // Check the wall before spending a request, not after - showing cards and
  // then taking them away is the one thing that makes people delete an app.
  const start = useCallback(
    async (src) => {
      const q = await checkQuota();
      if (!q.allowed) {
        // A subscriber who hits the fair-use ceiling is a paying customer, not
        // a lead - show them a note, never the paywall they already bought.
        if (q.fairUse) {
          alert(
            "That's a lot of scanning",
            "You've hit today's limit. It resets at midnight - and if you genuinely need more, tell us.",
          );
          return;
        }
        setPaywallReason('quota');
        setScreen('paywall');
        return;
      }
      setSource(src);
      setScreen('generating');
      run(src);
    },
    [run],
  );

  // Photos queue up for review; a PDF goes straight through, since there is
  // nothing to preview and it is never one of a set.
  const addPages = useCallback((incoming) => {
    setPages((prev) => [...prev, ...incoming].slice(0, MAX_PAGES));
    setScreen('review');
  }, []);

  // Restore / import: merge into what is here, never overwrite progress.
  // Returns how many decks were new.
  const importDecks = useCallback(async (incoming) => {
    const current = await loadDecks();
    const known = new Set(current.map((d) => d.id));
    const merged = mergeDecks(current, incoming);
    setDecks(await saveAllDecks(merged));
    return incoming.filter((d) => !known.has(d.id)).length;
  }, []);

  const openTalk = useCallback((ctx) => {
    setTalkContext(ctx);
    setScreen('talk');
  }, []);

  const handlePick = useCallback(
    async (kind) => {
      setSheetOpen(false);
      if (kind === 'camera') return;
      if (kind === 'write') {
        setScreen('create');
        return;
      }
      if (kind === 'talk') {
        openTalk({ back: 'camera' });
        return;
      }
      if (kind === 'youtube') {
        setLinkOpen(true);
        return;
      }

      try {
        const picked =
          kind === 'library' ? await pickFromLibrary() : await pickDocument();
        // Backing out of the system picker is not an error - do nothing.
        if (!picked) return;

        // A deck or backup file is free: nothing is sent anywhere.
        if (picked.kind === 'deckfile') {
          const decks = await readDeckFile(picked.uri);
          await importDecks(decks);
          setScreen('library');
          return;
        }
        // A PDF opens first - reading it is free. Making cards from it is
        // the one Pro gate, and it sits on the button, not the picker.
        if (picked.kind === 'pdf') {
          setDoc({ source: picked, back: 'camera', canGenerate: true });
          setScreen('document');
          return;
        }
        addPages(picked.pages);
      } catch (e) {
        alert("Couldn't open that", e.message);
      }
    },
    [start, addPages, importDecks, openTalk],
  );

  const makeCardsFromDoc = useCallback(async () => {
    if (!doc?.source) return;
    if (!(await canUseDocuments())) {
      setPaywallReason('documents');
      setScreen('paywall');
      return;
    }
    const src = doc.source;
    setDoc(null);
    start(src);
  }, [doc, start]);

  const openSource = useCallback((deck, back) => {
    if (!deck?.source) return;
    if (deck.source.kind === 'youtube') {
      setVid({ video: deck.source, back, canGenerate: false });
      setScreen('video');
      return;
    }
    setDoc({ source: deck.source, back, canGenerate: false });
    setScreen('document');
  }, []);

  const renameDeck = useCallback(async (deck) => {
    setDecks(await saveDeck(deck));
    if (activeRef.current?.id === deck.id) setActiveDeck(deck);
  }, []);

  // Manual decks cost nothing and count against nothing.
  const saveManualDeck = useCallback(async (deck) => {
    setDecks(await saveDeck(deck));
    setActiveDeck(deck);
    setScreen('study');
  }, []);

  const generateFromPages = useCallback(() => {
    if (!pages.length) return;
    start({ kind: 'images', pages, name: pages[0].name || null });
  }, [pages, start]);

  const updateDeck = useCallback(async (deck, { rated, rating } = {}) => {
    if (rated) {
      setStreak((await touchStreak()).count);
      logJournal({ rated: 1, ...(rating ? { [rating]: 1 } : {}) });
    }
    const prev = activeRef.current;
    setActiveDeck(deck);

    // A cross-deck session is a view over other decks, never saved as its own.
    // Each card carries the id of the deck it came from; anything that was in
    // the session and isn't any more was deleted.
    if (deck.virtual) {
      const kept = new Set(deck.cards.map((c) => c.id));
      const removed = (prev?.cards ?? []).filter((c) => !kept.has(c.id)).map((c) => c.id);
      setDecks(await saveCards(deck.cards, removed));
      return;
    }
    setDecks(await saveDeck(deck));
  }, []);

  // Everything due, across every deck, oldest first. Cards remember their
  // deck so ratings route back to the right place.
  const reviewDue = useCallback(() => {
    const now = Date.now();
    const cards = decks
      .flatMap((d) =>
        d.cards
          .filter((c) => !c.srs || c.srs.due <= now)
          .map((c) => ({ ...c, deckId: d.id })),
      )
      .sort((a, b) => (a.srs?.due ?? 0) - (b.srs?.due ?? 0));
    if (!cards.length) return;
    setActiveDeck({ id: `due_${now}`, title: 'Due today', virtual: true, createdAt: now, cards });
    setScreen('study');
  }, [decks]);

  // Study for one exam: everything due across its decks, or all of its
  // cards if nothing is due yet - the night before, "nothing due" is not
  // an answer anyone wants.
  const studyExam = useCallback(
    (exam, mode = 'cards') => {
      const linked = examDecks(exam, decks);
      if (!linked.length) {
        setEditingExam(exam);
        setScreen('exam');
        return;
      }
      setStudyMode(mode);
      const now = Date.now();
      let cards = linked.flatMap((d) =>
        d.cards.filter((c) => !c.srs || c.srs.due <= now).map((c) => ({ ...c, deckId: d.id })),
      );
      if (!cards.length) cards = linked.flatMap((d) => d.cards.map((c) => ({ ...c, deckId: d.id })));
      setActiveDeck({ id: `exam_${now}`, title: exam.title, virtual: true, createdAt: now, cards });
      setScreen('study');
    },
    [decks],
  );

  // A talk becomes a deck the same way pasted notes do.
  const cardsFromTalk = useCallback(
    (talk) => {
      setTalkContext(null);
      start({ kind: 'text', text: talk.transcript, name: talk.title });
    },
    [start],
  );

  // --- notebooks and notes -------------------------------------------------
  const openNotebook = useCallback((nb) => {
    setActiveNotebook(nb);
    setScreen('notebook');
  }, []);

  // "New" with no notebook picks the most recent one, or makes the first.
  const newNote = useCallback(
    async (nb, back = 'notebooks') => {
      let book = nb || notebooks.find((b) => !b.archived);
      if (!book) {
        book = makeNotebook('Notes');
        setNotebooks(await saveNotebook(book));
      }
      setNoteDraft({ note: makeNote(book.id), notebook: book, isNew: true, back });
      setScreen('note');
    },
    [notebooks],
  );

  const openNote = useCallback(
    (note, back) => {
      const book = notebooks.find((b) => b.id === note.notebookId) || null;
      setNoteDraft({ note, notebook: book, isNew: false, back });
      setScreen('note');
    },
    [notebooks],
  );

  const closeNote = useCallback(() => {
    const back = noteDraft?.back || 'notebooks';
    setNoteDraft(null);
    setScreen(back);
  }, [noteDraft]);

  const commitNote = useCallback(
    async (note) => {
      setNotes(await saveNote(note));
      closeNote();
    },
    [closeNote],
  );

  const removeNote = useCallback(
    async (note) => {
      setNotes(await deleteNote(note.id));
      closeNote();
    },
    [closeNote],
  );

  // Study-first: the words become cards like pasted notes; the photos
  // become cards like a scan. Same quota, same paywall, same study screen.
  const cardsFromNote = useCallback(
    async (note) => {
      const text = (note.text || '').trim();
      if (text.length >= 40) {
        await saveNote(note).then(setNotes);
        setNoteDraft(null);
        start({ kind: 'text', text, name: note.title || undefined });
        return;
      }
      const pages = (note.images || []).map((i) => ({ uri: fileUri(i) })).filter((p) => p.uri);
      if (!pages.length) return;
      await saveNote(note).then(setNotes);
      setNoteDraft(null);
      start({ kind: 'images', pages, name: note.title || undefined });
    },
    [start],
  );

  const nameNotebook = useCallback(
    async (title) => {
      if (naming?.notebook) {
        setNotebooks(await saveNotebook({ ...naming.notebook, title }));
        if (activeNotebook?.id === naming.notebook.id) setActiveNotebook({ ...naming.notebook, title });
      } else {
        const book = makeNotebook(title);
        setNotebooks(await saveNotebook(book));
        openNotebook(book);
      }
      setNaming(null);
    },
    [naming, activeNotebook, openNotebook],
  );

  const coverNotebook = useCallback(async (nb) => {
    try {
      const picked = await pickFromLibrary();
      if (!picked?.pages?.length) return;
      const cover = await importImage(picked.pages[0].uri);
      if (nb.cover?.file) deleteFiles([nb.cover.file]);
      const next = { ...nb, cover: { file: cover.file, uri: cover.uri } };
      setNotebooks(await saveNotebook(next));
      setActiveNotebook((a) => (a?.id === nb.id ? next : a));
    } catch (e) {
      alert("Couldn't set that cover", e.message);
    }
  }, []);

  const archiveNotebook = useCallback(async (nb) => {
    const next = { ...nb, archived: !nb.archived };
    setNotebooks(await saveNotebook(next));
    setActiveNotebook((a) => (a?.id === nb.id ? next : a));
  }, []);

  const removeNotebook = useCallback(async (nb) => {
    const r = await deleteNotebook(nb.id);
    setNotebooks(r.notebooks);
    setNotes(r.notes);
    setActiveNotebook((a) => (a?.id === nb.id ? null : a));
    setScreen('notebooks');
  }, []);

  const notebookActions = useCallback(
    (nb) =>
      alert(nb.title, null, [
        { text: 'Rename', onPress: () => setNaming({ notebook: nb }) },
        { text: 'Change cover', onPress: () => coverNotebook(nb) },
        { text: nb.archived ? 'Unarchive' : 'Archive', onPress: () => archiveNotebook(nb) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            alert('Delete notebook?', `"${nb.title}" and every note in it will be gone.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => removeNotebook(nb) },
            ]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]),
    [coverNotebook, archiveNotebook, removeNotebook],
  );

  const writeGuide = useCallback(async (exam, plan) => {
    const guide = await generateGuide(
      { title: exam.title, cards: plan.cards },
      { tier: (await isSubscribed()) ? 'pro' : 'free' },
    );
    const next = { ...exam, guide: { ...guide, generatedAt: Date.now(), cardCount: plan.total } };
    setExams(await saveExam(next));
    setViewingExam(next);
  }, []);

  const nextExam = upcoming(exams).find((e) => e.date >= new Date().toISOString().slice(0, 10)) ?? null;

  // The hidden wordmark gesture. Already admin -> offer to turn it off, so
  // the paywall and free tier can be checked on the same phone.
  const adminTap = useCallback(() => {
    if (quota.admin) {
      alert('Admin is on', 'Turn it off to see the app as a normal user?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            await disableAdmin();
            refresh();
          },
        },
      ]);
      return;
    }
    setAdminOpen(true);
  }, [quota.admin, refresh]);

  const appendToDeck = useCallback((deck) => {
    setAppendTo(deck);
    setActiveDeck(null);
    setScreen('camera');
  }, []);

  // Backing out of a failed request keeps the pages: the fix is usually to
  // start the server or wait, not to reshoot the lecture.
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setSource(null);
    setScreen(pages.length ? 'review' : 'camera');
  }, [pages.length]);

  // Dev-only escape hatch from a failed request: pretend it worked, with the
  // sample deck standing in for the model's output. Goes through the same
  // append/save path as a real result so that path gets exercised too.
  const useSampleInstead = useCallback(async () => {
    const fresh = makeSampleDeck();
    const deck = appendTo ? { ...appendTo, cards: [...appendTo.cards, ...fresh.cards] } : fresh;
    setDecks(await saveDeck(deck));
    setError(null);
    setSource(null);
    setAppendTo(null);
    setPages([]);
    setActiveDeck(deck);
    setScreen('study');
  }, [appendTo]);

  const discardPages = useCallback(() => {
    setPages([]);
    setScreen('camera');
  }, []);

  const backToCamera = useCallback(() => {
    setStudyMode('cards');
    if (viewingExam) {
      setActiveDeck(null);
      setScreen('examhub');
      return;
    }
    setActiveDeck(null);
    setAppendTo(null);
    setPages([]);
    setSource(null);
    setScreen('camera');
  }, [viewingExam]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <ErrorBoundary>
          <View style={styles.root}>
            {screen === 'camera' && (
              <Screen preset="fade">
                <CameraScreen
                  quota={pro ? { remaining: Infinity, admin: quota.admin } : quota}
                  appendTo={appendTo}
                  onCancelAppend={() => setAppendTo(null)}
                  onAdminTap={adminTap}
                  nextExam={nextExam}
                  pageCount={pages.length}
                  onOpenReview={() => setScreen('review')}
                  onCapture={(photo) => addPages([photo])}
                  onOpenSource={() => setSheetOpen(true)}
                  onOpenLibrary={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'video' && vid ? (
              <Screen preset="modal">
                <VideoScreen
                  video={vid.video}
                  canGenerate={vid.canGenerate}
                  onMakeCards={(src) => {
                    const back = vid.back;
                    setVid(null);
                    start(src);
                    // start() moves to 'generating'; a failed request's Back
                    // returns to the camera/review as usual.
                  }}
                  onClose={() => {
                    const back = vid.back;
                    setVid(null);
                    setScreen(back);
                  }}
                />
              </Screen>
            ) : null}

            {screen === 'document' && doc ? (
              <Screen preset="modal">
                <DocumentScreen
                  source={doc.source}
                  onMakeCards={doc.canGenerate ? makeCardsFromDoc : undefined}
                  onClose={() => {
                    const back = doc.back;
                    setDoc(null);
                    setScreen(back);
                  }}
                />
              </Screen>
            ) : null}

            {screen === 'talk' && (
              <Screen preset="modal">
                <TalkScreen
                  context={talkContext}
                  onSave={async (talk) => {
                    setTalks(await saveTalk(talk));
                    logJournal({ talks: 1, talkSeconds: Math.round(talk.duration || 0) });
                    setScreen(talkContext?.back ?? 'talks');
                  }}
                  onMakeCards={cardsFromTalk}
                  onClose={() => setScreen(talkContext?.back ?? 'library')}
                />
              </Screen>
            )}

            {screen === 'shared' && (
              <Screen preset="modal">
                <SharedDeckScreen
                  state={shared}
                  saving={savingShared}
                  onSave={saveShared}
                  onClose={() => {
                    setShared(null);
                    clearShareUrl();
                    setScreen('camera');
                  }}
                />
              </Screen>
            )}

            {screen === 'journal' && (
              <Screen preset="push">
                <JournalScreen streak={streak} onClose={() => setScreen('library')} />
              </Screen>
            )}

            {screen === 'notebooks' && (
              <Screen preset="push" maxWidth={LIBRARY}>
                <NotebooksScreen
                  notebooks={notebooks}
                  notes={notes}
                  onOpenNotebook={openNotebook}
                  onCreateNotebook={() => setNaming({})}
                  onRenameNotebook={(nb) => setNaming({ notebook: nb })}
                  onCoverNotebook={coverNotebook}
                  onArchiveNotebook={archiveNotebook}
                  onDeleteNotebook={removeNotebook}
                  onOpenNote={(n) => openNote(n, 'notebooks')}
                  onNewNote={(nb) => newNote(nb, 'notebooks')}
                  onStrip={(picked) => {
                    setStripCtx({ notes: picked, notebook: null, back: 'notebooks' });
                    setScreen('strip');
                  }}
                  onClose={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'notebook' && activeNotebook && (
              <Screen preset="push">
                <NotebookScreen
                  notebook={notebooks.find((b) => b.id === activeNotebook.id) ?? activeNotebook}
                  notes={notes.filter((n) => n.notebookId === activeNotebook.id)}
                  onOpenNote={(n) => openNote(n, 'notebook')}
                  onNewNote={(nb) => newNote(nb, 'notebook')}
                  onEdit={notebookActions}
                  onStrip={(picked) => {
                    setStripCtx({ notes: picked, notebook: activeNotebook, back: 'notebook' });
                    setScreen('strip');
                  }}
                  onClose={() => setScreen('notebooks')}
                />
              </Screen>
            )}

            {screen === 'note' && noteDraft && (
              <Screen preset="modal">
                <NoteEditorScreen
                  note={noteDraft.note}
                  notebook={noteDraft.notebook}
                  isNew={noteDraft.isNew}
                  onSave={commitNote}
                  onDelete={removeNote}
                  onClose={closeNote}
                  onMakeCards={cardsFromNote}
                />
              </Screen>
            )}

            {screen === 'strip' && stripCtx && (
              <Screen preset="modal">
                <StripScreen
                  notes={stripCtx.notes}
                  notebook={stripCtx.notebook ?? notebooks.find((b) => b.id === stripCtx.notes[0]?.notebookId) ?? null}
                  onClose={() => {
                    const back = stripCtx.back;
                    setStripCtx(null);
                    setScreen(back);
                  }}
                />
              </Screen>
            )}

            {screen === 'talks' && (
              <Screen preset="push">
                <TalksScreen
                  talks={talks}
                  decks={decks}
                  onRecord={() => openTalk({ back: 'talks' })}
                  onMakeCards={cardsFromTalk}
                  onDelete={async (id) => setTalks(await deleteTalk(id))}
                  onClose={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'examhub' && viewingExam && (
              <Screen preset="push">
                <ExamScreen
                  exam={exams.find((e) => e.id === viewingExam.id) ?? viewingExam}
                  decks={decks}
                  onStudy={studyExam}
                  onGuide={writeGuide}
                  onTalk={(e) => openTalk({ title: e.title, examId: e.id, back: 'examhub' })}
                  onEdit={(e) => {
                    setEditingExam(e);
                    setScreen('exam');
                  }}
                  onClose={() => {
                    setViewingExam(null);
                    setScreen('library');
                  }}
                />
              </Screen>
            )}

            {screen === 'exam' && (
              <Screen preset="modal">
                <ExamEditorScreen
                  exam={editingExam}
                  decks={decks}
                  onSave={async (exam) => {
                    setExams(await saveExam(exam));
                    setEditingExam(null);
                    if (viewingExam?.id === exam.id) {
                      setViewingExam(exam);
                      setScreen('examhub');
                    } else {
                      setScreen('library');
                    }
                  }}
                  onDelete={async (id) => {
                    setExams(await deleteExam(id));
                    setEditingExam(null);
                    setViewingExam(null);
                    setScreen('library');
                  }}
                  onClose={() => {
                    setEditingExam(null);
                    setScreen(viewingExam ? 'examhub' : 'library');
                  }}
                />
              </Screen>
            )}

            {screen === 'board' && (
              <Screen preset="modal">
                <BoardScreen
                  onPrivateNote={() => setScreen('feedback')}
                  onClose={() => setScreen(activeDeck ? 'study' : 'library')}
                />
              </Screen>
            )}

            {screen === 'feedback' && (
              <Screen preset="modal">
                <FeedbackScreen
                  tier={quota.admin ? 'admin' : pro ? 'pro' : 'free'}
                  deckCount={decks.length}
                  onClose={() => setScreen(activeDeck ? 'study' : 'library')}
                />
              </Screen>
            )}

            {screen === 'settings' && (
              <Screen preset="push">
                <SettingsScreen
                  tier={quota.admin ? 'admin' : pro ? 'pro' : 'free'}
                  deckCount={decks.length}
                  onImport={importDecks}
                  onNameChange={setNameState}
                  onFeedback={() => setScreen('board')}
                  onClose={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'create' && (
              <Screen preset="modal">
                <DeckEditorScreen
                  onSave={saveManualDeck}
                  onGenerate={(text, name) => start({ kind: 'text', text, name })}
                  onClose={() => setScreen('camera')}
                />
              </Screen>
            )}

            {screen === 'review' && (
              <Screen preset="push">
                <ReviewScreen
                  pages={pages}
                  appendTo={appendTo}
                  onRemove={(i) => {
                    const next = pages.filter((_, j) => j !== i);
                    setPages(next);
                    if (!next.length) setScreen('camera');
                  }}
                  onAddCamera={() => setScreen('camera')}
                  onAddLibrary={() => handlePick('library')}
                  onGenerate={generateFromPages}
                  onCancel={discardPages}
                />
              </Screen>
            )}

            {screen === 'generating' && (
              <Screen preset="fade">
                <GeneratingScreen
                  source={source}
                  error={error}
                  onRetry={() => {
                    setError(null);
                    run(source);
                  }}
                  onCancel={cancel}
                  onUseSample={__DEV__ ? useSampleInstead : undefined}
                />
              </Screen>
            )}

            {screen === 'study' && activeDeck && (
              <Screen preset="push">
                <StudyScreen
                  key={activeDeck.id}
                  initialMode={studyMode}
                  deck={activeDeck}
                  onUpdateDeck={updateDeck}
                  onAddPages={appendToDeck}
                  onFeedback={() => setScreen('board')}
                  name={name}
                  onTalk={(d) => openTalk({ title: d.title, deckId: d.virtual ? null : d.id, back: 'study' })}
                  onRename={(d) => setRenaming(d)}
                  onPaywall={(reason) => {
                    setPaywallReason(reason);
                    setScreen('paywall');
                  }}
                  onClose={backToCamera}
                />
              </Screen>
            )}

            {screen === 'library' && (
              <Screen preset="push" maxWidth={LIBRARY}>
                <LibraryScreen
                  decks={decks}
                  streak={streak}
                  onOpen={(deck) => {
                    setActiveDeck(deck);
                    setScreen('study');
                  }}
                  onReviewDue={reviewDue}
                  onRename={(d) => setRenaming(d)}
                  onOpenSource={(d) => openSource(d, 'library')}
                  talkCount={talks.length}
                  noteCount={notes.length}
                  onOpenNotebooks={() => setScreen('notebooks')}
                  onOpenTalks={() => setScreen('talks')}
                  onAddPages={appendToDeck}
                  onCreate={() => setScreen('create')}
                  onSettings={() => setScreen('settings')}
                  onJournal={() => setScreen('journal')}
                  exams={exams}
                  onAddExam={() => {
                    setEditingExam(null);
                    setScreen('exam');
                  }}
                  onOpenExam={(e) => {
                    setViewingExam(e);
                    setScreen('examhub');
                  }}
                  onEditExam={(e) => {
                    setEditingExam(e);
                    setScreen('exam');
                  }}
                  onDelete={async (id) => {
                    const gone = decks.find((d) => d.id === id);
                    await dropSource(gone);
                    await deleteFigures(gone);
                    setDecks(await deleteDeck(id));
                  }}
                  onLoadSample={async () => {
                    // Two decks, so the library looks like a real one: the
                    // due-across-decks button and exams have something to do.
                    await saveDeck(makeSampleDeck());
                    setDecks(await saveDeck(makeBiologySampleDeck()));
                  }}
                  onClose={() => setScreen('camera')}
                />
              </Screen>
            )}

            {screen === 'paywall' && (
              <Screen preset="modal">
                <PaywallScreen
                  reason={paywallReason}
                  onClose={() => setScreen('camera')}
                  onPurchased={async () => {
                    await refresh();
                    setScreen('camera');
                  }}
                />
              </Screen>
            )}

            <SourceSheet
              visible={sheetOpen}
              isPro={pro}
              onPick={handlePick}
              onClose={() => setSheetOpen(false)}
            />

            <LinkSheet
              visible={linkOpen}
              onClose={() => setLinkOpen(false)}
              onSubmit={(video) => {
                setLinkOpen(false);
                setVid({ video, back: 'camera', canGenerate: true });
                setScreen('video');
              }}
            />

            <RenameSheet
              deck={renaming}
              visible={!!renaming}
              onSave={renameDeck}
              onClose={() => setRenaming(null)}
            />
            <NameSheet
              visible={!!naming}
              heading={naming?.notebook ? 'Rename' : 'New notebook'}
              initial={naming?.notebook?.title || ''}
              placeholder="Biology, Japan trip, Random thoughts"
              onSave={nameNotebook}
              onClose={() => setNaming(null)}
            />

            {!opening && askName ? (
              <NameAsk
                onDone={(n) => {
                  setAskName(false);
                  if (n) setNameState(n);
                }}
              />
            ) : null}

            {opening ? <Opening onDone={() => setOpening(false)} /> : null}

            <AdminSheet
              visible={adminOpen}
              onClose={() => setAdminOpen(false)}
              onEnabled={async () => {
                setAdminOpen(false);
                await refresh();
              }}
            />
          </View>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // overflow hidden: screens slide in from off-screen right; without the
  // clip, mobile browsers measure the page as twice as wide mid-animation,
  // zoom out to fit, and stay zoomed out.
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
});

export default wrapRoot(App);
