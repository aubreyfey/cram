import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cram.reminder.v1';

// Notifications are the one thing that brings someone back to a spaced-
// repetition app without them having to remember it exists. Local only - no
// push service, no server, nothing leaves the phone. Not available on web.
const supported = Platform.OS !== 'web';

// Lazy so the web bundle never touches the native module.
async function notifications() {
  const N = await import('expo-notifications');
  return N;
}

export const REMINDER_TIMES = [
  { label: '8am', hour: 8, minute: 0 },
  { label: 'Noon', hour: 12, minute: 0 },
  { label: '5pm', hour: 17, minute: 0 },
  { label: '8pm', hour: 20, minute: 0 },
  { label: '9pm', hour: 21, minute: 0 },
];

export async function getReminder() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { enabled: false, hour: 20, minute: 0 };
  } catch {
    return { enabled: false, hour: 20, minute: 0 };
  }
}

// Ask once, on the first enable. Returns false if the user said no, in
// which case the toggle stays off rather than pretending.
async function ensurePermission() {
  const N = await notifications();
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await N.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

export async function setReminder({ enabled, hour, minute }) {
  const next = { enabled, hour, minute };
  if (!supported) {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...next, enabled: false }));
    return { ...next, enabled: false, unsupported: true };
  }

  const N = await notifications();
  await N.cancelAllScheduledNotificationsAsync();

  if (enabled) {
    if (!(await ensurePermission())) {
      await AsyncStorage.setItem(KEY, JSON.stringify({ ...next, enabled: false }));
      return { ...next, enabled: false, denied: true };
    }
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('reminders', {
        name: 'Study reminders',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    // The body can't know tonight's due count - a local trigger is fixed
    // when scheduled - so it says the one true thing instead.
    await N.scheduleNotificationAsync({
      content: {
        title: 'Cards are waiting',
        body: 'Ten minutes now beats an hour the night before.',
        sound: 'default',
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'reminders',
      },
    });
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// Foreground behaviour: show the banner even if the app is open. Called once
// at startup; harmless on web where it is a no-op.
export async function configureNotifications() {
  if (!supported) return;
  const N = await notifications();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
