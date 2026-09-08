import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from './src/screens/CameraScreen';
import GeneratingScreen from './src/screens/GeneratingScreen';
import StudyScreen from './src/screens/StudyScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import PaywallScreen from './src/screens/PaywallScreen';

import { generateDeck } from './src/lib/api';
import { addUsage, deleteDeck, loadDecks, saveDeck } from './src/lib/storage';
import { checkQuota, isSubscribed } from './src/lib/entitlements';
import { colors } from './src/theme';

export default function App() {
  const [screen, setScreen] = useState('camera');
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState({ allowed: true, remaining: 10 });
  const [pro, setPro] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);

  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    setDecks(await loadDecks());
    setQuota(await checkQuota());
    setPro(await isSubscribed());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (uri) => {
      setError(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const deck = await generateDeck(uri, { signal: controller.signal });
        if (controller.signal.aborted) return;

        setDecks(await saveDeck(deck));
        if (!(await isSubscribed())) await addUsage(deck.cards.length);
        setQuota(await checkQuota());

        setActiveDeck(deck);
        setScreen('study');
      } catch (e) {
        if (e.name === 'AbortError') return;
        setError(e);
      }
    },
    [],
  );

  const onCapture = useCallback(
    async (uri) => {
      // Check the wall before spending a request, not after - showing cards and
      // then taking them away is the one thing that makes people delete an app.
      const q = await checkQuota();
      if (!q.allowed) {
        setPaywallReason('quota');
        setScreen('paywall');
        return;
      }
      setPhotoUri(uri);
      setScreen('generating');
      run(uri);
    },
    [run],
  );

  const updateDeck = useCallback(async (deck) => {
    setActiveDeck(deck);
    setDecks(await saveDeck(deck));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setPhotoUri(null);
    setScreen('camera');
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.root}>
          {screen === 'camera' && (
            <CameraScreen
              quota={pro ? { remaining: Infinity } : quota}
              onCapture={onCapture}
              onOpenLibrary={() => setScreen('library')}
            />
          )}

          {screen === 'generating' && (
            <GeneratingScreen
              photoUri={photoUri}
              error={error}
              onRetry={() => {
                setError(null);
                run(photoUri);
              }}
              onCancel={cancel}
            />
          )}

          {screen === 'study' && activeDeck && (
            <StudyScreen
              deck={activeDeck}
              onUpdateDeck={updateDeck}
              onClose={() => {
                setActiveDeck(null);
                setPhotoUri(null);
                setScreen('camera');
              }}
            />
          )}

          {screen === 'library' && (
            <LibraryScreen
              decks={decks}
              isPro={pro}
              onOpen={(deck) => {
                setActiveDeck(deck);
                setScreen('study');
              }}
              onDelete={async (id) => setDecks(await deleteDeck(id))}
              onUpgrade={() => {
                setPaywallReason('library');
                setScreen('paywall');
              }}
              onClose={() => setScreen('camera')}
            />
          )}

          {screen === 'paywall' && (
            <PaywallScreen
              reason={paywallReason}
              onClose={() => setScreen('camera')}
              onPurchased={async () => {
                await refresh();
                setScreen('camera');
              }}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
