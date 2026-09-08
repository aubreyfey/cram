import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Screen from './src/components/Screen';
import SourceSheet from './src/components/SourceSheet';
import CameraScreen from './src/screens/CameraScreen';
import GeneratingScreen from './src/screens/GeneratingScreen';
import StudyScreen from './src/screens/StudyScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import PaywallScreen from './src/screens/PaywallScreen';

import { generateDeck } from './src/lib/api';
import { pickDocument, pickFromLibrary } from './src/lib/pickers';
import { addUsage, deleteDeck, loadDecks, saveDeck } from './src/lib/storage';
import { canUseDocuments, checkQuota, isSubscribed } from './src/lib/entitlements';
import { makeSampleDeck } from './src/lib/sampleDeck';
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

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    setDecks(await loadDecks());
    setQuota(await checkQuota());
    setPro(await isSubscribed());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(async (src) => {
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const deck = await generateDeck(src, { signal: controller.signal });
      if (controller.signal.aborted) return;

      setDecks(await saveDeck(deck));
      // Recorded for everyone, not just free users - subscribers don't meter
      // cards, but their scans still cost us money and feed the fair-use check.
      await addUsage(deck.cards.length);
      setQuota(await checkQuota());

      setActiveDeck(deck);
      setScreen('study');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e);
    }
  }, []);

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

  const handlePick = useCallback(
    async (kind) => {
      setSheetOpen(false);
      if (kind === 'camera') return;

      if (kind === 'files' && !(await canUseDocuments())) {
        setPaywallReason('documents');
        setScreen('paywall');
        return;
      }

      try {
        const picked =
          kind === 'library' ? await pickFromLibrary() : await pickDocument();
        // Backing out of the system picker is not an error - do nothing.
        if (picked) start(picked);
      } catch (e) {
        Alert.alert("Couldn't open that", e.message);
      }
    },
    [start],
  );

  const updateDeck = useCallback(async (deck) => {
    setActiveDeck(deck);
    setDecks(await saveDeck(deck));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setSource(null);
    setScreen('camera');
  }, []);

  const backToCamera = useCallback(() => {
    setActiveDeck(null);
    setSource(null);
    setScreen('camera');
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.root}>
          {screen === 'camera' && (
            <Screen preset="fade">
              <CameraScreen
                quota={pro ? { remaining: Infinity } : quota}
                onCapture={start}
                onOpenSource={() => setSheetOpen(true)}
                onOpenLibrary={() => setScreen('library')}
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
              />
            </Screen>
          )}

          {screen === 'study' && activeDeck && (
            <Screen preset="push">
              <StudyScreen
                deck={activeDeck}
                onUpdateDeck={updateDeck}
                onClose={backToCamera}
              />
            </Screen>
          )}

          {screen === 'library' && (
            <Screen preset="push">
              <LibraryScreen
                decks={decks}
                isPro={pro}
                onOpen={(deck) => {
                  setActiveDeck(deck);
                  setScreen('study');
                }}
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
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
