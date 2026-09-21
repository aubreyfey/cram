import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ApiError } from './api';
import { firstName, getProfile } from './profile';

// A deck as a link: <siteUrl>/d/<id>. The web build opens it as a
// "save this deck" page; the app opens it straight to the same screen
// (cram://d/<id>, or the https link once universal links are set up).
// The copy that travels is cards only - the sharer's schedule, Why?
// explanations and pictures stay home.

const extra = Constants.expoConfig?.extra ?? {};
const SITE = (extra.siteUrl || '').replace(/\/$/, '');
const BASE_URL = extra.apiBaseUrl || '';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-cram-key': extra.appKey ?? '',
});

export async function createShareLink(deck) {
  const by = firstName((await getProfile()).name) || null;
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/share`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ deck: { title: deck.title, subject: deck.subject, by, cards: deck.cards } }),
    });
  } catch {
    throw new ApiError("Couldn't reach Cram's servers. Try again in a moment.", 'network');
  }
  if (res.status === 503) throw new ApiError("Links aren't set up yet. Share as text for now.", 'not_configured');
  if (res.status === 429) throw new ApiError("That's a lot of links. Give it an hour.", 'rate_limit');
  if (!res.ok) throw new ApiError("Couldn't make a link for that deck.", 'server');
  const { id } = await res.json();
  return `${SITE}/d/${id}`;
}

export async function fetchSharedDeck(id) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/share?id=${encodeURIComponent(id)}`);
  } catch {
    throw new ApiError("Couldn't reach Cram's servers. Try again in a moment.", 'network');
  }
  if (res.status === 404) throw new ApiError('That link has expired or never existed.', 'not_found');
  if (!res.ok) throw new ApiError("Couldn't open that deck right now.", 'server');
  const { deck } = await res.json();
  return deck;
}

// The id in a share link, or null. Accepts https://<site>/d/<id> and
// cram://d/<id>; anything else (a YouTube link, a random URL) is not ours.
export function parseShareUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/^(?:https?:\/\/[^/]+|cram:\/?\/?)\/?d\/([A-Za-z0-9]{6,32})\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

// What lands in the library: a fresh deck with its own ids, so it never
// collides with the sharer's own copy on the same phone, and no schedule -
// the recipient starts from zero.
export function deckFromShared(shared) {
  const stamp = Date.now();
  return {
    id: `deck_${stamp}`,
    title: shared.title || 'Shared deck',
    subject: shared.subject || null,
    createdAt: stamp,
    sourceKind: 'shared',
    sharedBy: shared.by || null,
    cards: (shared.cards || []).map((c, i) => ({
      id: `card_${stamp}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}

// On the web the address bar still says /d/<id> after the deck is saved or
// dismissed; a reload would open it again. Put the URL back to the root.
export function clearShareUrl() {
  if (Platform.OS !== 'web') return;
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    // Not a browser that lets us.
  }
}
