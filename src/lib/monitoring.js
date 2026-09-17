import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

// Crash reporting. Off until a DSN exists - Sentry.init with no dsn is a
// documented no-op, so the code path is identical in both states and there
// is nothing to remember to turn on later except pasting the DSN.
//
// Deliberately minimal: errors only, no session replay, no performance
// traces, no PII. A study app does not need to watch people; it needs to
// know when it crashed.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn || '';

export const monitoringEnabled = !!DSN;

export function initMonitoring() {
  Sentry.init({
    dsn: DSN,
    enabled: !!DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version,
    // Development crashes show up in the red box already.
    beforeSend: (event) => (__DEV__ ? null : event),
  });
}

// For errors we catch ourselves (the boundary, a failed request that
// shouldn't have failed). Silent when disabled.
export function reportError(error, context) {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const wrapRoot = (component) => (DSN ? Sentry.wrap(component) : component);
