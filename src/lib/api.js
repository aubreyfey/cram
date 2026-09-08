import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import { readBase64 } from './files';

const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';

// Claude accepts PDFs up to 32MB per request, but a file that size takes far
// too long to upload on campus wifi to be worth attempting.
const MAX_PDF_BYTES = 12 * 1024 * 1024;

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Downscale before upload. A 12MP camera frame is ~4MB and adds seconds of
// upload; 1400px wide is still comfortably legible to the model for
// handwriting and keeps the round trip inside our budget.
async function prepareImage(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1400 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { data: result.base64, mediaType: 'image/jpeg' };
}

async function preparePdf(uri, size) {
  if (size && size > MAX_PDF_BYTES) {
    throw new ApiError(
      "That PDF is too big. Try a single chapter rather than the whole book.",
      'too_large',
    );
    }
  const data = await readBase64(uri);
  return { data, mediaType: 'application/pdf' };
}

/**
 * @param {{uri: string, kind: 'image'|'pdf', size?: number, name?: string}} source
 */
export async function generateDeck(source, { signal } = {}) {
  const { data, mediaType } =
    source.kind === 'pdf'
      ? await preparePdf(source.uri, source.size)
      : await prepareImage(source.uri);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
      },
      body: JSON.stringify({ data, mediaType }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('No connection. Check your wifi and try again.', 'network');
  }

  if (res.status === 429) {
    throw new ApiError("You're going fast. Give it a minute.", 'rate_limit');
  }
  if (res.status === 413) {
    throw new ApiError('That file is too big to send. Try a smaller one.', 'too_large');
  }
  if (!res.ok) {
    throw new ApiError(
      source.kind === 'pdf'
        ? "Couldn't read that PDF. Is it a scan of a scan?"
        : "That page didn't scan. Try better light.",
      'server',
    );
  }

  const result = await res.json();
  if (!result.cards?.length) {
    throw new ApiError("Couldn't find anything to study in that.", 'empty');
  }

  return {
    id: `deck_${Date.now()}`,
    title: result.title || source.name || 'Untitled deck',
    subject: result.subject || null,
    createdAt: Date.now(),
    sourceKind: source.kind,
    cards: result.cards.map((c, i) => ({
      id: `card_${Date.now()}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}
