import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Mascot from '../components/Mascot';
import PrimaryButton from '../components/PrimaryButton';
import SignInSheet from '../components/SignInSheet';
import {
  STATUS,
  boardIsLive,
  getSession,
  listFeedback,
  listUpdates,
  signIn,
  signOut,
  submitFeedback,
  toggleVote,
  verifyCode,
} from '../lib/board';
import { alert } from '../lib/alert';
import { colors, radius, space, type } from '../theme';

// The board: Feedback (everything, by votes), Roadmap (planned / in
// progress / done), Updates (what shipped). Reading needs nothing; posting
// and voting need a sign-in, which is an email and a code - no password.
const TABS = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'updates', label: 'Updates' },
];

const TONE = {
  dim: colors.textDim,
  faint: colors.textFaint,
  accent: colors.accent,
  hard: colors.hard,
  good: colors.good,
};

export default function BoardScreen({ onClose, onPrivateNote }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('feedback');
  const [session, setSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [composing, setComposing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [s, p, u] = await Promise.all([getSession(), listFeedback(), listUpdates()]);
      setSession(s);
      setPosts(p);
      setUpdates(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Anything that needs an account goes through here: if there is no
  // session, remember what they wanted and open sign-in; do it after.
  const withAccount = (action) => {
    if (session) return action();
    setPendingAction(() => action);
    setSigningIn(true);
  };

  const vote = (post) =>
    withAccount(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Optimistic - the number moves under the thumb, then the truth arrives.
      setPosts((ps) =>
        ps.map((p) =>
          p.id === post.id ? { ...p, voted: !p.voted, votes: p.votes + (p.voted ? -1 : 1) } : p,
        ),
      );
      try {
        const r = await toggleVote(post.id);
        setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, ...r } : p)));
      } catch (e) {
        alert("Couldn't vote", e.message);
        refresh();
      }
    });

  const onSignedIn = async (s) => {
    setSession(s);
    setSigningIn(false);
    await refresh();
    const action = pendingAction;
    setPendingAction(null);
    if (action) action();
  };

  const roadmap = {
    planned: posts.filter((p) => p.status === 'planned'),
    in_progress: posts.filter((p) => p.status === 'in_progress'),
    done: posts.filter((p) => p.status === 'done'),
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(2) }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={16}>
          <Text style={styles.close}>Done</Text>
        </Pressable>
        <Text style={styles.title}>What's next</Text>
        <Pressable
          onPress={() =>
            session
              ? alert(session.user.email, null, [
                  { text: 'Sign out', style: 'destructive', onPress: () => signOut().then(refresh) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              : setSigningIn(true)
          }
          hitSlop={12}
        >
          <Text style={styles.account} numberOfLines={1}>
            {session ? session.user.name : 'Sign in'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTab(t.key);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!boardIsLive ? (
        <Text style={styles.demo}>DEMO · this device only until Supabase is set up</Text>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space(24) }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.empty}>
            <Mascot mood="oops" size={64} />
            <Text style={styles.emptyText}>{error}</Text>
            <PrimaryButton label="Try again" variant="ghost" onPress={refresh} style={{ marginTop: space(4) }} />
          </View>
        ) : loading && !posts.length ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space(16) }} />
        ) : tab === 'feedback' ? (
          <>
            <Text style={styles.lead}>Upvote what you want. The most-wanted things get built first.</Text>
            {posts.length ? (
              posts.map((p, i) => <Post key={p.id} post={p} index={i} onVote={() => vote(p)} />)
            ) : (
              <Empty text="Nothing here yet. Be the first." />
            )}
          </>
        ) : tab === 'roadmap' ? (
          <>
            <Section title="IN PROGRESS" items={roadmap.in_progress} onVote={vote} />
            <Section title="PLANNED" items={roadmap.planned} onVote={vote} />
            <Section title="DONE" items={roadmap.done} onVote={vote} />
            {!roadmap.planned.length && !roadmap.in_progress.length && !roadmap.done.length ? (
              <Empty text="Nothing on the roadmap yet. Upvote things on the Feedback tab to get them here." />
            ) : null}
          </>
        ) : (
          <>
            {updates.length ? (
              updates.map((u, i) => (
                <Animated.View key={u.id} entering={FadeInDown.delay(i * 40).duration(280)} style={styles.update}>
                  <View style={styles.updateHead}>
                    {u.version ? <Text style={styles.version}>v{u.version}</Text> : null}
                    <Text style={styles.date}>{ago(u.createdAt)}</Text>
                  </View>
                  <Text style={styles.updateTitle}>{u.title}</Text>
                  {u.body ? <Text style={styles.updateBody}>{u.body}</Text> : null}
                </Animated.View>
              ))
            ) : (
              <Empty text="No updates yet." />
            )}
          </>
        )}

        {onPrivateNote ? (
          <Pressable onPress={onPrivateNote} style={styles.privateLink} hitSlop={8}>
            <Text style={styles.privateText}>Something broke? Send a private note instead</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {tab === 'feedback' ? (
        <View style={[styles.fab, { bottom: insets.bottom + space(5) }]}>
          <PrimaryButton label="+ Suggest something" onPress={() => withAccount(() => setComposing(true))} />
        </View>
      ) : null}

      <ComposeSheet
        visible={composing}
        onClose={() => setComposing(false)}
        onPosted={() => {
          setComposing(false);
          refresh();
        }}
      />
      <SignInSheet
        visible={signingIn}
        onClose={() => {
          setSigningIn(false);
          setPendingAction(null);
        }}
        onSignedIn={onSignedIn}
        sub="No password. We email you a code, you type it, done. Posting and voting need it; reading never does."
        via={{ signIn, verifyCode }}
        demo={!boardIsLive}
      />
    </View>
  );
}

function Section({ title, items, onVote }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: space(4) }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((p, i) => (
        <Post key={p.id} post={p} index={i} onVote={() => onVote(p)} compact />
      ))}
    </View>
  );
}

function Post({ post, index, onVote, compact }) {
  const s = STATUS[post.status] ?? STATUS.pending;
  const tone = TONE[s.tone];
  const muted = post.status === 'declined';
  return (
    <Animated.View entering={FadeInDown.delay(index * 35).duration(260)} style={[styles.post, muted && { opacity: 0.55 }]}>
      <Pressable onPress={onVote} style={[styles.voteBox, post.voted && styles.voteBoxOn]} hitSlop={6}>
        <Text style={[styles.voteArrow, post.voted && { color: colors.accentInk }]}>▲</Text>
        <Text style={[styles.voteCount, post.voted && { color: colors.accentInk }]}>{post.votes}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.postTitle}>{post.title}</Text>
        {post.body && !compact ? (
          <Text style={styles.postBody} numberOfLines={3}>
            {post.body}
          </Text>
        ) : null}
        <View style={styles.postMeta}>
          <View style={[styles.pill, { borderColor: tone + '66' }]}>
            <Text style={[styles.pillText, { color: tone }]}>{s.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.by}>
            {post.authorName} · {ago(post.createdAt)}
          </Text>
        </View>
        {post.note ? (
          <View style={styles.note}>
            <Text style={styles.noteKicker}>CRAM</Text>
            <Text style={styles.noteText}>{post.note}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Mascot mood="idle" size={64} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ComposeSheet({ visible, onClose, onPosted }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const post = async () => {
    if (title.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await submitFeedback({ title: title.trim(), body: body.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle('');
      setBody('');
      onPosted();
    } catch (e) {
      alert("Didn't post", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheetHead, { paddingTop: Platform.OS === 'ios' ? space(4) : insets.top }]}>
          <Pressable onPress={onClose} hitSlop={16}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>Suggest something</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.inputTitle}
            value={title}
            onChangeText={setTitle}
            autoFocus
            maxLength={120}
            placeholder="One line: what should Cram do?"
            placeholderTextColor={colors.textFaint}
          />
          <TextInput
            style={styles.inputBody}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            placeholder="Why? When would you use it? (optional)"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.hint}>Check the list first - if it's already there, upvote it instead.</Text>
        </ScrollView>
        <View style={[styles.sheetFoot, { paddingBottom: insets.bottom + space(4) }]}>
          <PrimaryButton
            label={busy ? 'Posting…' : 'Post'}
            variant={title.trim().length >= 3 ? 'accent' : 'solid'}
            onPress={post}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ago(ts) {
  const d = Math.round((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  const m = Math.round(d / 30);
  return `${m}mo ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
  },
  close: { ...type.body, fontWeight: '700', color: colors.textDim, width: 56 },
  title: { ...type.body, fontWeight: '800', fontSize: 17, color: colors.text },
  account: { ...type.body, fontSize: 14, fontWeight: '700', color: colors.accent, maxWidth: 110, textAlign: 'right' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: space(6),
    marginTop: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: { flex: 1, paddingVertical: space(2), borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { ...type.label, fontSize: 12, color: colors.textDim },
  tabTextActive: { color: colors.accentInk },
  demo: { ...type.mono, fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: space(3) },
  body: { paddingHorizontal: space(6), paddingTop: space(4) },
  lead: { ...type.body, fontSize: 14, color: colors.textDim, marginBottom: space(4) },
  sectionTitle: { ...type.mono, color: colors.textFaint, marginBottom: space(2), marginTop: space(2) },
  post: {
    flexDirection: 'row',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space(4),
    marginBottom: space(3),
  },
  voteBox: {
    width: 44,
    paddingVertical: space(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  voteBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  voteArrow: { fontSize: 11, color: colors.accent },
  voteCount: { ...type.body, fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 1 },
  postTitle: { ...type.body, fontSize: 16, fontWeight: '700', color: colors.text },
  postBody: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(1) },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: 2 },
  pillText: { ...type.mono, fontSize: 9 },
  by: { ...type.body, fontSize: 12, color: colors.textFaint },
  note: {
    marginTop: space(3),
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: space(3),
  },
  noteKicker: { ...type.mono, fontSize: 9, color: colors.accent },
  noteText: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: 2 },
  update: {
    paddingVertical: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  updateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  version: { ...type.mono, color: colors.accent },
  date: { ...type.mono, color: colors.textFaint },
  updateTitle: { ...type.body, fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space(2) },
  updateBody: { ...type.body, fontSize: 14, color: colors.textDim, marginTop: space(1) },
  empty: { alignItems: 'center', paddingTop: space(12), paddingHorizontal: space(8) },
  emptyText: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space(4) },
  privateLink: { alignSelf: 'center', marginTop: space(8) },
  privateText: { ...type.body, fontSize: 13, color: colors.textFaint },
  fab: { position: 'absolute', left: space(6), right: space(6) },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(6),
    paddingBottom: space(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sheetTitle: { ...type.body, fontWeight: '700', color: colors.text },
  sheetBody: { padding: space(6) },
  sheetFoot: { paddingHorizontal: space(6), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  inputTitle: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    marginTop: space(4),
  },
  hint: { ...type.body, fontSize: 13, color: colors.textFaint, marginTop: space(3) },
  inputBody: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: space(3),
  },
});
