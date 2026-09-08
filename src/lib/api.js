import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';

const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Downscale before upload. A 12MP camera frame is ~4MB and adds seconds of
// upload on campus wifi; 1400px wide is still comfortably legible to the
// model for handwriting and keeps the round trip inside our 3s budget.
async function prepare(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1400 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return result.base64;
}

export async function generateDeck(photoUri, { signal } = {}) {
  const base64 = await prepare(photoUri);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
      },
      body: JSON.stringify({ image: base64 }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('No connection. Check your wifi and try again.', 'network');
  }

  if (res.status === 429) {
    throw new ApiError("You're going fast. Give it a minute.", 'rate_limit');
  }
  if (!res.ok) {
    throw new ApiError("That page didn't scan. Try better light.", 'server');
  }

  const data = await res.json();
  if (!data.cards?.length) {
    throw new ApiError(
      "Couldn't find anything to study on that page.",
      'empty',
    );
  }

  return {
    id: `deck_${Date.now()}`,
    title: data.title || 'Untitled deck',
    subject: data.subject || null,
    createdAt: Date.now(),
    cards: data.cards.map((c, i) => ({
      id: `card_${Date.now()}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}
