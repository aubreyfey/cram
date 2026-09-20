import Constants from 'expo-constants';

// The feedback board: what people want, what's coming, what shipped.
//
// One interface, two backends. With extra.supabaseUrl + supabaseAnonKey set
// the board is shared and real (see supabase/schema.sql). Without them it
// runs on this device only, seeded with example posts, so the screens can
// be seen and tested before the project exists. The screens never know
// which one they are talking to.
//
//   getSession()                  -> { user: { id, email, name } } | null
//   signIn(email)                 -> sends a one-time code
//   verifyCode(email, code)       -> session
//   signOut()
//   listFeedback()                -> [{ id, title, body, status, note, votes, voted, authorName, createdAt }]
//   submitFeedback({ title, body })
//   toggleVote(id)                -> { votes, voted }
//   listUpdates()                 -> [{ id, version, title, body, createdAt }]

const URL = Constants.expoConfig?.extra?.supabaseUrl || '';
const KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

export const boardIsLive = !!(URL && KEY);

export const STATUS = {
  pending: { label: 'Pending', tone: 'dim' },
  planned: { label: 'Planned', tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'hard' },
  done: { label: 'Done', tone: 'good' },
  declined: { label: 'Not planned', tone: 'faint' },
};

let impl = null;
async function backend() {
  if (impl) return impl;
  impl = boardIsLive
    ? (await import('./boardSupabase')).createSupabaseBoard(URL, KEY)
    : (await import('./boardLocal')).createLocalBoard();
  return impl;
}

export const getSession = async () => (await backend()).getSession();
export const signIn = async (email) => (await backend()).signIn(email);
export const verifyCode = async (email, code) => (await backend()).verifyCode(email, code);
export const signOut = async () => (await backend()).signOut();
export const listFeedback = async () => (await backend()).listFeedback();
export const submitFeedback = async (post) => (await backend()).submitFeedback(post);
export const toggleVote = async (id) => (await backend()).toggleVote(id);
export const listUpdates = async () => (await backend()).listUpdates();
