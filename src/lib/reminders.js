import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firstName, getProfile } from './profile';

const KEY = 'cram.reminder.v1';
const NAG_MINUTES = 5;
const ALARM_SOUND = 'volt-alarm.wav';

// Notifications are the one thing that brings someone back to a spaced-
// repetition app without them having to remember it exists. Local only - no
// push service, no server, nothing leaves the phone. Not available on web.
//
// Two notifications, not one:
//   reminder - daily, at the time they picked, polite.
//   nag      - one-shot, five minutes after the reminder, loud: its own
//              alarm sound, vibration, time-sensitive so it gets through
//              Focus. Cancelled the moment the app is opened, so anyone who
//              actually studies never hears it. Re-armed for tomorrow on
//              every open.
//
// What this deliberately doesn't do: ring like a phone call. iOS only allows
// that for real VoIP calls and rejects apps that fake it. Time-sensitive is
// the loudest an ordinary app can be without a special entitlement.
const supported = Platform.OS !== 'web';

// Lazy so the web bundle never touches the native module.
async function notifications() {
  return await import('expo-notifications');
}

export const REMINDER_TIMES = [
  { label: '8am', hour: 8, minute: 0 },
  { label: 'Noon', hour: 12, minute: 0 },
  { label: '5pm', hour: 17, minute: 0 },
  { label: '8pm', hour: 20, minute: 0 },
  { label: '9pm', hour: 21, minute: 0 },
];

// Volt's follow-up lines. Picked when the nag is scheduled, so each day gets
// a different one.
const NAG_LINES = [
  "It's been five minutes. Volt has stopped blinking.",
  "You picked this time. Volt remembers everything - that's the whole point.",
  'The cards are still due. Volt is still here. Nothing has changed except the time.',
  "Five minutes late. Volt is not angry, just... waiting. Loudly.",
  "Volt would like to remind you that 'later' is not a study strategy.",
];

const DEFAULTS = { enabled: false, hour: 20, minute: 0, nag: true, nagId: null };

export async function getReminder() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

async function save(r) {
  await AsyncStorage.setItem(KEY, JSON.stringify(r));
  return r;
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

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  const N = await notifications();
  await N.setNotificationChannelAsync('reminders', {
    name: 'Study reminders',
    importance: N.AndroidImportance.DEFAULT,
  });
  await N.setNotificationChannelAsync('alarms', {
    name: 'Missed-study alarm',
    importance: N.AndroidImportance.MAX,
    sound: ALARM_SOUND,
    vibrationPattern: [0, 400, 200, 400, 200, 800],
    enableVibrate: true,
    bypassDnd: true,
  });
}

function nextOccurrence(hour, minute, offsetMinutes = 0) {
  const d = new Date();
  d.setHours(hour, minute + offsetMinutes, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function alarmContent(body) {
  return {
    title: 'VOLT',
    body,
    sound: ALARM_SOUND,
    // iOS: gets through Focus modes the user has allowed time-sensitive
    // notifications for. 'critical' would need Apple's entitlement.
    interruptionLevel: 'timeSensitive',
    ...(Platform.OS === 'android' ? { vibrate: [0, 400, 200, 400, 200, 800] } : {}),
  };
}

// Schedules (or reschedules) the nag for the next reminder + 5 minutes.
// Called on every app open so an opened app always pushes it to tomorrow.
export async function rearmNag() {
  if (!supported) return;
  const r = await getReminder();
  const N = await notifications();
  if (r.nagId) {
    await N.cancelScheduledNotificationAsync(r.nagId).catch(() => {});
    r.nagId = null;
  }
  if (!r.enabled || !r.nag) return save(r);

  await ensureChannels();
  const who = firstName((await getProfile()).name);
  const pick = NAG_LINES[Math.floor(Math.random() * NAG_LINES.length)];
  const line = who ? `${who}. ${pick}` : pick;
  r.nagId = await N.scheduleNotificationAsync({
    content: alarmContent(line),
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: nextOccurrence(r.hour, r.minute, NAG_MINUTES),
      channelId: 'alarms',
    },
  });
  return save(r);
}

export async function setReminder({ enabled, hour, minute, nag }) {
  const prev = await getReminder();
  const next = { ...prev, enabled, hour, minute, nag: nag ?? prev.nag };
  if (!supported) {
    return { ...(await save({ ...next, enabled: false })), unsupported: true };
  }

  const N = await notifications();
  await N.cancelAllScheduledNotificationsAsync();
  next.nagId = null;

  if (enabled) {
    if (!(await ensurePermission())) {
      return { ...(await save({ ...next, enabled: false })), denied: true };
    }
    await ensureChannels();
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

  await save(next);
  return await rearmNag();
}

// Fires the loud one 30 seconds from now, so a person can hear exactly what
// they signed up for without waiting until tomorrow.
export async function sendTestAlarm() {
  if (!supported) return { unsupported: true };
  if (!(await ensurePermission())) return { denied: true };
  await ensureChannels();
  const N = await notifications();
  await N.scheduleNotificationAsync({
    content: alarmContent('This is the loud one. Lock your phone - it comes in 30 seconds.'),
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30,
      channelId: 'alarms',
    },
  });
  return { ok: true };
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
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
