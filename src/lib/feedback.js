import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { ApiError, API_BASE_URL } from './api';

// One request, then a mailto fallback so feedback still has somewhere to go
// when there is no server (the GitHub Pages build) or it is down. The app
// version and platform ride along because "the swipe is broken" means
// nothing without knowing which build.
const EMAIL = Constants.expoConfig?.extra?.feedbackEmail || '';

export const AREAS = [
  { key: 'scanning', label: 'Scanning' },
  { key: 'studying', label: 'Studying' },
  { key: 'sharing', label: 'Sharing' },
  { key: 'design', label: 'Design' },
  { key: 'bug', label: 'Something broke' },
  { key: 'other', label: 'Something else' },
];

export function feedbackMeta({ tier, decks }) {
  return {
    version: Constants.expoConfig?.version ?? '',
    platform: Platform.OS,
    os: Platform.OS === 'web' ? '' : String(Platform.Version ?? ''),
    tier,
    decks,
  };
}

export async function sendFeedback({ message, area, contact, meta }) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cram-key': Constants.expoConfig?.extra?.appKey ?? '',
      },
      body: JSON.stringify({ message, area, contact, meta }),
    });
  } catch {
    res = null;
  }
  if (res?.ok) return { via: 'server' };
  if (res?.status === 429) throw new ApiError("That's a lot of feedback for one hour. Try later.", 'rate_limit');

  if (EMAIL) {
    const subject = encodeURIComponent(`Cram feedback: ${area}`);
    const body = encodeURIComponent(
      `${message}\n\n---\n${contact ? `Contact: ${contact}\n` : ''}App ${meta.version} on ${meta.platform} ${meta.os}`,
    );
    await Linking.openURL(`mailto:${EMAIL}?subject=${subject}&body=${body}`);
    return { via: 'email' };
  }

  throw new ApiError("Couldn't send that right now. Try again in a moment.", 'network');
}
