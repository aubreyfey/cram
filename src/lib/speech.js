// Speech-to-text, on device, free. expo-speech-recognition wraps Apple's and
// Google's recognisers (and the Web Speech API in Chrome). It is a native
// module, so it does not exist in Expo Go: there, `speechAvailable()` is
// false, recording still works, and the transcript can be typed. The first
// real build lights it up with no other change.
let mod = null;
let tried = false;

async function load() {
  if (tried) return mod;
  tried = true;
  try {
    const m = await import('expo-speech-recognition');
    if (m.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.()) mod = m.ExpoSpeechRecognitionModule;
  } catch {
    mod = null;
  }
  return mod;
}

export async function speechAvailable() {
  return !!(await load());
}

// Starts listening. Calls onText(finalSoFar, interim) as words arrive.
// With persist=true the recogniser also writes the audio to a file and
// hands back its uri on stop - one microphone consumer, no conflicts.
export async function startListening({ onText, onEnd, onError, persist = false, lang = 'en-US' }) {
  const M = await load();
  if (!M) return null;

  const perm = await M.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Microphone and speech recognition need to be allowed.');

  let finalText = '';
  let fileUri = null;
  const subs = [
    M.addListener('result', (e) => {
      const t = e.results?.[0]?.transcript ?? '';
      if (e.isFinal) {
        finalText = `${finalText} ${t}`.trim();
        onText?.(finalText, '');
      } else {
        onText?.(finalText, t);
      }
    }),
    M.addListener('audioend', (e) => {
      if (e?.uri) fileUri = e.uri;
    }),
    M.addListener('end', () => onEnd?.({ text: finalText, uri: fileUri })),
    M.addListener('error', (e) => {
      // "no-speech" after a pause is not an error worth showing.
      if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') onError?.(new Error(e.message || e.error));
    }),
  ];

  M.start({
    lang,
    interimResults: true,
    continuous: true,
    // Apple's on-device recogniser is good enough and keeps audio local.
    requiresOnDeviceRecognition: false,
    addsPunctuation: true,
    recordingOptions: persist ? { persist: true } : undefined,
  });

  return {
    stop: () => M.stop(),
    dispose: () => subs.forEach((s) => s.remove()),
  };
}
