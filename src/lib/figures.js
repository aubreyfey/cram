import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Pictures on cards. When the model says a card is about a diagram, it also
// says where on the page the diagram is (fractions of the image). This
// crops that region out of the original photo - full resolution, not the
// 1400px upload - and keeps it with the deck. Text-only cards never come
// through here.
//
//   card.figure: { file, side }        native - file lives in figures/
//                { uri, side }         web - a blob URL, lasts the session
//
// Files are named by card id and stored under the app's documents
// directory by *name*, not absolute path: iOS moves the container on every
// update, so a stored absolute path would dangle after the next release.

const DIR = 'figures';
// The model's boxes are tight. A little air around the figure keeps labels
// that sit on the edge from being sliced.
const MARGIN = 0.03;
const MAX_WIDTH = 1000;

// Crop every figure the server pointed at. Never throws: a crop that fails
// just leaves that card without a picture, which is where it started.
export async function attachFigures(cards, pages) {
  const wanted = cards.filter((c) => c.figure);
  if (!wanted.length) return cards;

  // One render per page gives its pixel size; the same context is reused
  // for every crop off that page.
  const sizes = new Map();
  const sizeOf = async (page) => {
    if (!sizes.has(page)) {
      const ref = await ImageManipulator.manipulate(pages[page - 1].uri).renderAsync();
      sizes.set(page, { width: ref.width, height: ref.height });
    }
    return sizes.get(page);
  };

  const out = [];
  for (const card of cards) {
    if (!card.figure) {
      out.push(card);
      continue;
    }
    const { page, x, y, w, h, side } = card.figure;
    try {
      const { width, height } = await sizeOf(page);
      const x0 = Math.max(0, x - MARGIN);
      const y0 = Math.max(0, y - MARGIN);
      const x1 = Math.min(1, x + w + MARGIN);
      const y1 = Math.min(1, y + h + MARGIN);
      const rect = {
        originX: Math.round(x0 * width),
        originY: Math.round(y0 * height),
        width: Math.max(1, Math.round((x1 - x0) * width)),
        height: Math.max(1, Math.round((y1 - y0) * height)),
      };
      const ctx = ImageManipulator.manipulate(pages[page - 1].uri).crop(rect);
      if (rect.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
      const ref = await ctx.renderAsync();
      const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      out.push({ ...card, figure: await keep(card.id, saved.uri, side) });
    } catch {
      out.push({ ...card, figure: null });
    }
  }
  return out;
}

// Moves a crop from the cache into figures/ and returns what the card
// stores. On web the blob URL is all there is.
async function keep(cardId, uri, side) {
  if (Platform.OS === 'web') return { uri, side };
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, DIR);
  dir.create({ intermediates: true, idempotent: true });
  const file = `${cardId}.jpg`;
  await new File(uri).move(new File(dir, file), { overwrite: true });
  return { file, side };
}

// Where to load a card's figure from, or null if it has none (or it was
// made on another phone - the cloud backup carries the name, not the bytes).
export function figureUri(figure) {
  if (!figure) return null;
  if (figure.uri) return figure.uri;
  if (!figure.file || Platform.OS === 'web') return null;
  // Synchronous on purpose: this runs in render. The module is already
  // loaded on native by the time any card is on screen.
  const { File, Paths } = require('expo-file-system');
  return new File(Paths.document, DIR, figure.file).uri;
}

// A deck is gone; so are its pictures.
export async function deleteFigures(deck) {
  if (Platform.OS === 'web') return;
  const files = (deck?.cards || []).map((c) => c.figure?.file).filter(Boolean);
  if (!files.length) return;
  try {
    const { File, Paths } = await import('expo-file-system');
    for (const name of files) {
      const f = new File(Paths.document, DIR, name);
      if (f.exists) f.delete();
    }
  } catch {
    // Already gone.
  }
}
