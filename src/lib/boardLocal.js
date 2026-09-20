import AsyncStorage from '@react-native-async-storage/async-storage';

// Demo board: this device only. Same shape as the real one so the screens
// are identical; seeded with plausible posts, clearly marked as examples,
// so the tabs have something to show before the project exists. Sign-in
// takes any email and accepts any code.
const KEY = 'cram.board.local.v1';
const DAY = 86400000;

function seed() {
  const now = Date.now();
  return {
    user: null,
    votedIds: [],
    feedback: [
      { id: 'ex1', title: 'Example: Sync between my phone and iPad', body: 'I study on the iPad at home and the phone on the bus.', status: 'planned', note: 'Coming with sign-in.', votes: 41, authorName: 'example', createdAt: now - 9 * DAY },
      { id: 'ex2', title: 'Example: Share a deck with a link', body: 'Pasting text works but a link would be one tap.', status: 'in_progress', note: '', votes: 33, authorName: 'example', createdAt: now - 6 * DAY },
      { id: 'ex3', title: 'Example: Explain why an answer is right', body: '', status: 'done', note: 'Shipped - tap WHY? on the back of any card.', votes: 27, authorName: 'example', createdAt: now - 14 * DAY },
      { id: 'ex4', title: 'Example: Pictures on cards', body: 'Diagrams come out as text and lose the point.', status: 'pending', note: '', votes: 12, authorName: 'example', createdAt: now - 2 * DAY },
      { id: 'ex5', title: 'Example: Dark mode toggle', body: '', status: 'declined', note: 'Cram is dark on purpose - it is most of the look.', votes: 4, authorName: 'example', createdAt: now - 20 * DAY },
    ],
    updates: [
      { id: 'u1', version: '1.0', title: 'This week, exams and a countdown', body: 'Add an exam, link decks, and Cram keeps the right cards in front of you with a countdown that turns amber at 3 days.', createdAt: now - 1 * DAY },
      { id: 'u2', version: '1.0', title: 'Four study modes', body: 'Cards, Quiz, Write and Blitz - all feeding the same schedule.', createdAt: now - 4 * DAY },
      { id: 'u3', version: '1.0', title: 'Volt', body: 'Cram has an owl now. He reacts to how you rate, and he has opinions about "later".', createdAt: now - 5 * DAY },
    ],
  };
}

export function createLocalBoard() {
  async function load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : seed();
    } catch {
      return seed();
    }
  }
  async function save(state) {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }

  return {
    async getSession() {
      const s = await load();
      return s.user ? { user: s.user } : null;
    },
    async signIn(email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That needs to be an email address.');
    },
    async verifyCode(email, code) {
      if (!code.trim()) throw new Error('Type the code.');
      const s = await load();
      s.user = { id: `local_${email.toLowerCase()}`, email, name: email.split('@')[0] };
      await save(s);
      return { user: s.user };
    },
    async signOut() {
      const s = await load();
      s.user = null;
      await save(s);
    },
    async listFeedback() {
      const s = await load();
      const voted = new Set(s.votedIds);
      return [...s.feedback]
        .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt)
        .map((f) => ({ ...f, voted: voted.has(f.id) }));
    },
    async submitFeedback({ title, body }) {
      const s = await load();
      if (!s.user) throw new Error('Sign in to post.');
      const id = `fb_${Date.now()}`;
      s.feedback.unshift({ id, title, body, status: 'pending', note: '', votes: 1, authorName: s.user.name, createdAt: Date.now() });
      s.votedIds.push(id);
      await save(s);
      return id;
    },
    async toggleVote(id) {
      const s = await load();
      if (!s.user) throw new Error('Sign in to vote.');
      const f = s.feedback.find((x) => x.id === id);
      if (!f) throw new Error('Gone.');
      const had = s.votedIds.includes(id);
      s.votedIds = had ? s.votedIds.filter((x) => x !== id) : [...s.votedIds, id];
      f.votes = Math.max(0, f.votes + (had ? -1 : 1));
      await save(s);
      return { votes: f.votes, voted: !had };
    },
    async listUpdates() {
      const s = await load();
      return [...s.updates].sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}
