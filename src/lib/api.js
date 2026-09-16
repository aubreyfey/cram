import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import { readBase64 } from './files';
import { getAdminCode } from './storage';

// On a phone, "localhost" is the phone. In development Metro already knows
// the laptop's LAN address (it is how the phone loaded the bundle), so borrow
// it rather than making anyone find their IP and edit app.json.
function resolveBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';
  const isLocal = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured);
  if (__DEV__ && Platform.OS !== 'web' && isLocal) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return configured.replace(/localhost|127\.0\.0\.1/, host);
  }
  return configured;
}

const BASE_URL = resolveBaseUrl();

// Photos per deck. Matches the server; more than this and the upload takes
// longer than the generation.
export const MAX_PAGES = 20;

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
 * A source is one of:
 *   { kind: 'pdf',    uri, size?, name? }
 *   { kind: 'images', pages: [{ uri }], name? }   one or many photos, in order
 *   { kind: 'image',  uri }                       shorthand for one page
 */
export async function generateDeck(source, { signal } = {}) {
  let body;
  if (source.kind === 'pdf') {
    body = await preparePdf(source.uri, source.size);
  } else {
    const pages = source.pages ?? [{ uri: source.uri }];
    if (pages.length > MAX_PAGES) {
      throw new ApiError(`That's a lot of pages. Try ${MAX_PAGES} or fewer at a time.`, 'too_many');
    }
    // One at a time - resizing twenty photos in parallel spikes memory on
    // older phones, and the resize is fast next to the upload anyway.
    const prepared = [];
    for (const p of pages) {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      prepared.push(await prepareImage(p.uri));
    }
    body = prepared.length === 1 ? prepared[0] : { pages: prepared };
  }

  const admin = await getAdminCode();
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
        ...(admin ? { 'x-cram-admin': admin } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    // A fetch rejection means we never reached the server at all. Blaming the
    // user's wifi is wrong and unhelpful when the real cause is usually that
    // the API isn't running or apiBaseUrl points somewhere that doesn't exist.
    throw new ApiError(
      __DEV__
        ? `Can't reach the Cram API at ${BASE_URL}. Is the server running?`
        : "Couldn't reach Cram's servers. Try again in a moment.",
      'network',
    );
  }

  if (res.status === 404) {
    throw new ApiError(
      __DEV__
        ? `No /api/generate at ${BASE_URL} - check extra.apiBaseUrl in app.json.`
        : "Can't reach Cram right now. Try again in a moment.",
      'not_found',
    );
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
    pageCount: source.pages?.length ?? 1,
    cards: result.cards.map((c, i) => ({
      id: `card_${Date.now()}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}

// Asks the server whether a code is the admin code. Resolves on success and
// throws a readable ApiError otherwise - the caller stores nothing until then.
export async function verifyAdminCode(code) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
      },
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new ApiError("Can't reach the Cram API to check that code.", 'network');
  }
  if (res.status === 503) {
    throw new ApiError('The server has no CRAM_ADMIN_KEY set.', 'not_configured');
  }
  if (res.status === 404) {
    throw new ApiError('The server has no /api/admin - deploy the latest server.', 'not_found');
  }
  if (!res.ok) {
    throw new ApiError("That's not it.", 'bad_code');
  }
}
