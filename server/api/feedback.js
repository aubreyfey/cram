// In-app feedback. Lands as a GitHub issue when FEEDBACK_GITHUB_TOKEN and
// FEEDBACK_GITHUB_REPO (owner/name) are set; otherwise it is logged, which
// on Vercel means it shows up in the function logs. Either way the app gets
// a 200, because the student has done their part.
//
// Use a private repo for the issues - people write their email in here.

const MAX = { message: 4000, contact: 200, area: 40 };

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip)?.filter((t) => now - t < 3_600_000) ?? [];
  entry.push(now);
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.length > 10;
}

function clip(v, n) {
  return typeof v === 'string' ? v.trim().slice(0, n) : '';
}

export default async function handler(req, res) {
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

  const body = req.body || {};
  const message = clip(body.message, MAX.message);
  const area = clip(body.area, MAX.area) || 'other';
  const contact = clip(body.contact, MAX.contact);
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
  if (!message) return res.status(400).json({ error: 'missing_message' });

  const title = `[${area}] ${message.split('\n')[0].slice(0, 70)}`;
  const details = [
    message,
    '',
    '---',
    contact ? `**Contact:** ${contact}` : '**Contact:** not given',
    `**App:** ${meta.version ?? '?'} on ${meta.platform ?? '?'} ${meta.os ?? ''}`,
    `**Tier:** ${meta.tier ?? '?'} · **Decks:** ${meta.decks ?? '?'}`,
  ].join('\n');

  const token = process.env.FEEDBACK_GITHUB_TOKEN;
  const repo = process.env.FEEDBACK_GITHUB_REPO;
  if (token && repo) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'cram-feedback',
        },
        body: JSON.stringify({ title, body: details, labels: ['feedback', area] }),
      });
      if (!r.ok) console.error('GitHub issue failed:', r.status, await r.text());
    } catch (e) {
      console.error('GitHub issue failed:', e.message);
    }
  } else {
    console.log('FEEDBACK\n' + title + '\n' + details);
  }

  return res.status(200).json({ ok: true });
}
