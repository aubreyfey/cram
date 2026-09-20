import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// One Supabase client for the whole app, so the feedback board and cloud
// backup share a single sign-in: signing in on the board backs you up, and
// vice versa. Nothing is created until something asks for it.
const URL = Constants.expoConfig?.extra?.supabaseUrl || '';
const KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

export const supabaseIsLive = !!(URL && KEY);

let client = null;

export function supabase() {
  if (!supabaseIsLive) throw new Error('Supabase is not configured.');
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

// Turns Supabase's error strings into something a student can act on.
export function friendly(error) {
  const m = error?.message || '';
  if (/rate limit/i.test(m)) return 'Too many tries. Give it a minute.';
  if (/invalid|expired/i.test(m) && /token|otp|code/i.test(m)) return "That code didn't match. Check the email and try again.";
  if (/network|fetch/i.test(m)) return "Can't reach Cram's servers right now.";
  return m || 'Something went wrong.';
}
