import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { attachFigures } from './figures';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
export const API_BASE_URL = BASE_URL;

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
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1400 }).renderAsync();
  const result = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
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
 *   { kind: 'text',   text, name? }               pasted notes
 */
export async function generateDeck(source, { signal, tier = 'free' } = {}) {
  let body;
  if (source.kind === 'text') {
    body = { text: source.text };
  } else if (source.kind === 'pdf') {
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
        'x-cram-tier': tier,
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
        : source.kind === 'text'
          ? "Couldn't make cards from that. Try a longer passage."
          : "That page didn't scan. Try better light.",
      'server',
    );
  }

  const result = await res.json();
  if (!result.cards?.length) {
    throw new ApiError("Couldn't find anything to study in that.", 'empty');
  }

  const stamp = Date.now();
  let cards = result.cards.map((c, i) => ({
    id: `card_${stamp}_${i}`,
    front: c.front,
    back: c.back,
    hint: c.hint || null,
    figure: c.figure || null,
  }));
  // Cards the model tied to a diagram get the diagram, cropped from the
  // original photo. Only photos: text and PDF sources never carry a box.
  if (source.kind !== 'text' && source.kind !== 'pdf') {
    cards = await attachFigures(cards, source.pages ?? [{ uri: source.uri }]);
  } else {
    cards = cards.map((c) => ({ ...c, figure: null }));
  }

  return {
    id: `deck_${stamp}`,
    title: result.title || source.name || 'Untitled deck',
    subject: result.subject || null,
    createdAt: stamp,
    sourceKind: source.kind,
    pageCount: source.pages?.length ?? 1,
    cards,
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

// "Why?" on a card. Returns the explanation text; the caller caches it on
// the card so this runs at most once per card.
export async function explainCard(card, { subject, signal } = {}) {
  const admin = await getAdminCode();
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
        ...(admin ? { 'x-cram-admin': admin } : {}),
      },
      body: JSON.stringify({ front: card.front, back: card.back, subject: subject || undefined }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(
      __DEV__ ? `Can't reach the Cram API at ${BASE_URL}.` : "Couldn't reach Cram right now.",
      'network',
    );
  }
  if (res.status === 429) throw new ApiError('Give it a minute.', 'rate_limit');
  if (!res.ok) throw new ApiError("Couldn't explain that one. Try again.", 'server');
  const { explanation } = await res.json();
  return explanation;
}

// A study guide for one exam, from its cards. The caller caches it on the
// exam with the card count, so it is rewritten only when the decks change.
export async function generateGuide({ title, cards }, { tier = 'free', signal } = {}) {
  const admin = await getAdminCode();
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
        'x-cram-tier': tier,
        ...(admin ? { 'x-cram-admin': admin } : {}),
      },
      body: JSON.stringify({ title, cards }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(
      __DEV__ ? `Can't reach the Cram API at ${BASE_URL}.` : "Couldn't reach Cram right now.",
      'network',
    );
  }
  if (res.status === 429) throw new ApiError('A few guides an hour is the limit. Try again later.', 'rate_limit');
  if (!res.ok) throw new ApiError("Couldn't write a guide from those cards. Try again.", 'server');
  return await res.json();
}

// Captions for a YouTube link. Resolves even when YouTube refuses: the
// result then has transcript null and a reason, and the screen falls back
// to pasting the transcript. Only a bad link or an unreachable server throws.
export async function fetchYouTube(url) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/youtube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
      },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ApiError(
      __DEV__ ? `Can't reach the Cram API at ${BASE_URL}.` : "Couldn't reach Cram right now.",
      'network',
    );
  }
  if (res.status === 400) throw new ApiError("That doesn't look like a YouTube link.", 'bad_url');
  if (res.status === 429) throw new ApiError('Give it a minute.', 'rate_limit');
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  return { videoId: data.videoId ?? null, title: data.title ?? null, transcript: null, reason: data.error || 'fetch_failed' };
}

// Recognises a YouTube link on the client so the video can be shown even
// when the server is down.
export function youtubeId(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m =
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
  return m ? m[1] : null;
}
