import { Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Rate and share. Both are asked for at the right moment, not from a
// button in a menu (though the menu has them too, for people who want to).
//
// Apple's rule for requestReview is "after a signature interaction, never
// from a button, don't spam" - iOS also caps it at three prompts a year
// regardless. So: only after a clean sweep, only after the third finished
// deck, never twice in a month. The Settings row opens the store page
// instead, which is what a button is allowed to do.
const KEY = 'cram.growth.v1';
const MONTH = 30 * 86400000;

const extra = Constants.expoConfig?.extra ?? {};
const SHARE_URL = extra.shareUrl || extra.siteUrl || '';

async function state() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { finished: 0, lastAsked: 0 };
  } catch {
    return { finished: 0, lastAsked: 0 };
  }
}

// Called when a deck is finished. Decides whether this is the moment.
export async function maybeAskForReview({ cleanSweep }) {
  if (Platform.OS === 'web') return false;
  const s = await state();
  s.finished += 1;
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
  if (!cleanSweep || s.finished < 3 || Date.now() - s.lastAsked < MONTH) return false;

  try {
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, lastAsked: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

// The Settings row: straight to the store listing, or the site until there
// is one. Returns false if there is nowhere to send them yet.
export async function openStorePage() {
  const url =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.appStoreUrl
      : Platform.OS === 'android'
        ? Constants.expoConfig?.android?.playStoreUrl
        : null;
  const target = url || SHARE_URL;
  if (!target) return false;
  await Linking.openURL(target);
  return true;
}

export function storeIsListed() {
  return !!(Constants.expoConfig?.ios?.appStoreUrl || Constants.expoConfig?.android?.playStoreUrl);
}

// One line, one link. Written like a person, not a marketing team.
export async function shareCram() {
  const link = SHARE_URL;
  const message = link
    ? `Cram turns a photo of your notes into flashcards in about three seconds. ${link}`
    : 'Cram turns a photo of your notes into flashcards in about three seconds.';
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url: link || undefined } : { message });
    return true;
  } catch {
    return false; // dismissed
  }
}
