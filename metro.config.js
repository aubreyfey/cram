// Sentry's wrapper around Expo's default Metro config: it only adds source
// map annotations so crashes point at real lines. Nothing else changes.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
