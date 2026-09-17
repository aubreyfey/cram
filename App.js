import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from './src/components/ErrorBoundary';
import AdminSheet from './src/components/AdminSheet';
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

import { MAX_PAGES, generateDeck } from './src/lib/api';
import { pickDocument, pickFromLibrary } from './src/lib/pickers';
import {
  addUsage,
  deleteDeck,
  getStreak,
  loadDecks,
  saveAllDecks,
  saveCards,
  saveDeck,
  touchStreak,
} from './src/lib/storage';
import { canUseDocuments, checkQuota, disableAdmin, isSubscribed } from './src/lib/entitlements';
import { makeSampleDeck } from './src/lib/sampleDeck';
import { mergeDecks, readDeckFile } from './src/lib/backup';
import { configureNotifications } from './src/lib/reminders';
import { colors } from './src/theme';

export default function App() {
  const [screen, setScreen] = useState('camera');
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState({ allowed: true, remaining: 10 });
  const [pro, setPro] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  // When set, the next scan's cards are appended to this deck instead of
  // making a new one. A lecture is thirty slides, not thirty decks.
  const [appendTo, setAppendTo] = useState(null);
  // Photos waiting on the review screen. Every capture and every library pick
  // lands here first; a deck is made from all of them at once.
  const [pages, setPages] = useState([]);

  const abortRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeDeck;

  const refresh = useCallback(async () => {
    setDecks(await loadDecks());
    setQuota(await checkQuota());
    setPro(await isSubscribed());
    setStreak((await getStreak()).count);
  }, []);

  useEffect(() => {
    refresh();
    configureNotifications();
  }, [refresh]);

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
        const deck = appendTo
          ? { ...appendTo, cards: [...appendTo.cards, ...fresh.cards] }
          : fresh;

        setDecks(await saveDeck(deck));
        // Recorded for everyone, not just free users - subscribers don't meter
        // cards, but their scans still cost us money and feed the fair-use check.
        await addUsage(fresh.cards.length);
        setQuota(await checkQuota());

        setAppendTo(null);
        setPages([]);
        setActiveDeck(deck);
        setScreen('study');
      } catch (e) {
        if (e.name === 'AbortError') return;
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
          Alert.alert(
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

  const handlePick = useCallback(
    async (kind) => {
      setSheetOpen(false);
      if (kind === 'camera') return;
      if (kind === 'write') {
        setScreen('create');
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
        // PDFs cost the most of any request, so they are the one Pro gate.
        if (picked.kind === 'pdf') {
          if (!(await canUseDocuments())) {
            setPaywallReason('documents');
            setScreen('paywall');
            return;
          }
          start(picked);
          return;
        }
        addPages(picked.pages);
      } catch (e) {
        Alert.alert("Couldn't open that", e.message);
      }
    },
    [start, addPages, importDecks],
  );

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

  const updateDeck = useCallback(async (deck, { rated } = {}) => {
    if (rated) setStreak((await touchStreak()).count);
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

  // The hidden wordmark gesture. Already admin -> offer to turn it off, so
  // the paywall and free tier can be checked on the same phone.
  const adminTap = useCallback(() => {
    if (quota.admin) {
      Alert.alert('Admin is on', 'Turn it off to see the app as a normal user?', [
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
    setActiveDeck(null);
    setAppendTo(null);
    setPages([]);
    setSource(null);
    setScreen('camera');
  }, []);

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
                  pageCount={pages.length}
                  onOpenReview={() => setScreen('review')}
                  onCapture={(photo) => addPages([photo])}
                  onOpenSource={() => setSheetOpen(true)}
                  onOpenLibrary={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'settings' && (
              <Screen preset="push">
                <SettingsScreen
                  tier={quota.admin ? 'admin' : pro ? 'pro' : 'free'}
                  deckCount={decks.length}
                  onImport={importDecks}
                  onClose={() => setScreen('library')}
                />
              </Screen>
            )}

            {screen === 'create' && (
              <Screen preset="modal">
                <DeckEditorScreen onSave={saveManualDeck} onClose={() => setScreen('camera')} />
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
                  deck={activeDeck}
                  onUpdateDeck={updateDeck}
                  onAddPages={appendToDeck}
                  onClose={backToCamera}
                />
              </Screen>
            )}

            {screen === 'library' && (
              <Screen preset="push">
                <LibraryScreen
                  decks={decks}
                  streak={streak}
                  isPro={pro}
                  onOpen={(deck) => {
                    setActiveDeck(deck);
                    setScreen('study');
                  }}
                  onReviewDue={reviewDue}
                  onAddPages={appendToDeck}
                  onCreate={() => setScreen('create')}
                  onSettings={() => setScreen('settings')}
                  onDelete={async (id) => setDecks(await deleteDeck(id))}
                  onLoadSample={async () => {
                    setDecks(await saveDeck(makeSampleDeck()));
                  }}
                  onUpgrade={() => {
                    setPaywallReason('library');
                    setScreen('paywall');
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
  root: { flex: 1, backgroundColor: colors.bg },
});
