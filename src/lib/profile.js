import AsyncStorage from '@react-native-async-storage/async-storage';

// The one thing the app knows about the person: what to call them. Optional,
// set in Settings, never asked for at launch. Used where a name makes a line
// warmer - the end of a deck, the nag, a shared deck - and nowhere it would
// be a form field. Stays on the device.
const KEY = 'cram.profile.v1';

export async function getProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { name: '' };
  } catch {
    return { name: '' };
  }
}

export async function setName(name) {
  const next = { name: (name || '').trim().slice(0, 40) };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// First name only, for greetings. "Aubrey Fey" -> "Aubrey".
export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || '';
}
