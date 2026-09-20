import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyChange } from './storage';

// The one thing the app knows about the person: what to call them. Asked
// once by Volt right after the first opening (skippable), editable in
// Settings, never required. Used where a name makes a line
// warmer - the end of a deck, the nag, a shared deck - and nowhere it would
// be a form field. Stays on the device.
const KEY = 'cram.profile.v1';

export async function getProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { asked: false, ...JSON.parse(raw) } : { name: '', asked: false };
  } catch {
    return { name: '', asked: false };
  }
}

// The launch question is asked once, ever - answered or skipped.
export async function markAsked() {
  const p = await getProfile();
  const next = { ...p, asked: true };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function setName(name) {
  const p = await getProfile();
  const next = { ...p, name: (name || '').trim().slice(0, 40), asked: true };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  notifyChange();
  return next;
}

// First name only, for greetings. "Aubrey Fey" -> "Aubrey".
export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

// From a cloud merge: a name from another phone, when this one has none.
// Quiet: no change notification.
export async function writeMergedName(name) {
  const p = await getProfile();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...p, name, asked: true }));
}
