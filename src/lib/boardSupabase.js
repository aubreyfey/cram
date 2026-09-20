import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// The real board. Sign-in is a one-time code by email - no password to
// forget, no name to make up (the name is the part of the email before @,
// which people can live with on a feedback board).
export function createSupabaseBoard(url, key) {
  const supabase = createClient(url, key, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  const toUser = (u) =>
    u ? { id: u.id, email: u.email, name: u.user_metadata?.name || u.email?.split('@')[0] || 'Someone' } : null;

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    const user = toUser(data.session?.user);
    return user ? { user } : null;
  }

  async function signIn(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(friendly(error));
  }

  async function verifyCode(email, code) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) throw new Error(friendly(error));
    return { user: toUser(data.user) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function listFeedback() {
    const session = await getSession();
    const [{ data: rows, error }, mine] = await Promise.all([
      supabase
        .from('feedback')
        .select('id, created_at, author_name, title, body, status, note, votes')
        .order('votes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
      session
        ? supabase.from('votes').select('feedback_id').eq('user_id', session.user.id)
        : Promise.resolve({ data: [] }),
    ]);
    if (error) throw new Error(friendly(error));
    const voted = new Set((mine.data || []).map((v) => v.feedback_id));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      status: r.status,
      note: r.note,
      votes: r.votes,
      voted: voted.has(r.id),
      authorName: r.author_name,
      createdAt: new Date(r.created_at).getTime(),
    }));
  }

  async function submitFeedback({ title, body }) {
    const session = await getSession();
    if (!session) throw new Error('Sign in to post.');
    const { data, error } = await supabase
      .from('feedback')
      .insert({ author_id: session.user.id, author_name: session.user.name, title, body })
      .select()
      .single();
    if (error) throw new Error(friendly(error));
    // Everyone upvotes their own idea. Do it for them.
    await supabase.from('votes').insert({ feedback_id: data.id, user_id: session.user.id });
    return data.id;
  }

  async function toggleVote(id) {
    const session = await getSession();
    if (!session) throw new Error('Sign in to vote.');
    const { data: existing } = await supabase
      .from('votes')
      .select('feedback_id')
      .eq('feedback_id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from('votes').delete().eq('feedback_id', id).eq('user_id', session.user.id);
    } else {
      const { error } = await supabase.from('votes').insert({ feedback_id: id, user_id: session.user.id });
      if (error) throw new Error(friendly(error));
    }
    const { data } = await supabase.from('feedback').select('votes').eq('id', id).single();
    return { votes: data?.votes ?? 0, voted: !existing };
  }

  async function listUpdates() {
    const { data, error } = await supabase
      .from('updates')
      .select('id, created_at, version, title, body')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(friendly(error));
    return data.map((u) => ({ ...u, createdAt: new Date(u.created_at).getTime() }));
  }

  return { getSession, signIn, verifyCode, signOut, listFeedback, submitFeedback, toggleVote, listUpdates };
}

function friendly(error) {
  const m = error?.message || '';
  if (/rate limit/i.test(m)) return 'Too many tries. Give it a minute.';
  if (/invalid|expired/i.test(m) && /token|otp|code/i.test(m)) return "That code didn't match. Check the email and try again.";
  if (/network|fetch/i.test(m)) return "Can't reach the board right now.";
  return m || 'Something went wrong.';
}
