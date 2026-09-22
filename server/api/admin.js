import { timingSafeEqual } from 'node:crypto';
import { cors } from '../lib/cors.js';

// Verifies an admin code. The code itself lives only in CRAM_ADMIN_KEY on the
// server; the app stores the code after one successful check and sends it as
// x-cram-admin on later requests. Nothing about it is in the app bundle, so
// pulling the IPA apart does not give anyone unlimited scans.
export function isAdminCode(code) {
  const secret = process.env.CRAM_ADMIN_KEY;
  if (!secret || typeof code !== 'string' || !code.length) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (process.env.CRAM_APP_KEY && req.headers['x-cram-key'] !== process.env.CRAM_APP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.CRAM_ADMIN_KEY) {
    return res.status(503).json({ error: 'admin_not_configured' });
  }
  if (!isAdminCode(req.body?.code)) {
    return res.status(401).json({ error: 'bad_code' });
  }
  return res.status(200).json({ ok: true });
}
