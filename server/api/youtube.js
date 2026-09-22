import { cors } from '../lib/cors.js';

// A YouTube link in, the video's captions out. No API key: the official
// Data API only hands captions to the video's owner, so this reads the
// public caption track the player itself loads. Auto-generated captions
// count. When there are none, or YouTube decides a server looks like a bot,
// the app falls back to "copy the transcript from YouTube and paste it" -
// so this can fail without the feature failing.
//
// Returns { videoId, title, language, auto, transcript, seconds }.

const MAX_CHARS = 60000;

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip)?.filter((t) => now - t < 60_000) ?? [];
  entry.push(now);
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.length > 10;
}

export function videoIdFrom(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function oembed(videoId) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    );
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// The watch page embeds the player config, including the caption tracks.
async function captionTracks(videoId) {
  const r = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers: HEADERS });
  if (!r.ok) throw new Error('watch_page');
  const html = await r.text();
  const m = html.match(/"captionTracks":(\[[^\]]*\])/);
  if (!m) {
    if (/consent\.youtube\.com|confirm you.re not a bot/i.test(html)) throw new Error('blocked');
    return [];
  }
  try {
    return JSON.parse(m[1].replace(/\\u0026/g, '&'));
  } catch {
    return [];
  }
}

function pickTrack(tracks) {
  const en = tracks.filter((t) => (t.languageCode || '').startsWith('en'));
  const manualEn = en.find((t) => t.kind !== 'asr');
  return manualEn || en[0] || tracks.find((t) => t.kind !== 'asr') || tracks[0] || null;
}

async function transcriptFor(track) {
  const url = `${track.baseUrl}${track.baseUrl.includes('?') ? '&' : '?'}fmt=json3`;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error('captions');
  const data = await r.json();
  const lines = [];
  let lastMs = 0;
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 || '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && text !== '[Music]' && text !== '[Applause]') lines.push(text);
    lastMs = Math.max(lastMs, (ev.tStartMs || 0) + (ev.dDurationMs || 0));
  }
  return { text: lines.join(' '), seconds: Math.round(lastMs / 1000) };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (process.env.CRAM_APP_KEY && req.headers['x-cram-key'] !== process.env.CRAM_APP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const videoId = videoIdFrom(req.body?.url);
  if (!videoId) return res.status(400).json({ error: 'bad_url' });

  const meta = await oembed(videoId);
  const title = meta?.title || null;

  let tracks;
  try {
    tracks = await captionTracks(videoId);
  } catch (e) {
    return res.status(e.message === 'blocked' ? 503 : 502).json({ error: e.message === 'blocked' ? 'blocked' : 'fetch_failed', videoId, title });
  }
  const track = pickTrack(tracks);
  if (!track) return res.status(422).json({ error: 'no_captions', videoId, title });

  let t;
  try {
    t = await transcriptFor(track);
  } catch {
    return res.status(502).json({ error: 'fetch_failed', videoId, title });
  }
  if (!t.text) return res.status(422).json({ error: 'no_captions', videoId, title });

  return res.status(200).json({
    videoId,
    title,
    language: track.languageCode || null,
    auto: track.kind === 'asr',
    transcript: t.text.slice(0, MAX_CHARS),
    truncated: t.text.length > MAX_CHARS,
    seconds: t.seconds,
  });
}
