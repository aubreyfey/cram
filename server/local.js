// Run the generate endpoint on your own machine, with no Vercel account.
//
//   cd server
//   npm install
//   ANTHROPIC_API_KEY=sk-ant-... node local.js
//
// On Windows PowerShell:
//   $env:ANTHROPIC_API_KEY = "sk-ant-..."
//   node local.js
//
// Then point app.json -> extra.apiBaseUrl at:
//   http://localhost:3000        (browser preview)
//   http://<your-lan-ip>:3000    (phone on the same wifi)
//
// This is for development. Deploy to Vercel for anything real - see README.

import http from 'node:http';
import generate from './api/generate.js';
import admin from './api/admin.js';
import feedback from './api/feedback.js';
import explain from './api/explain.js';
import guide from './api/guide.js';

const ROUTES = { '/api/generate': generate, '/api/admin': admin, '/api/feedback': feedback, '/api/explain': explain, '/api/guide': guide };

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 40 * 1024 * 1024;

// Load server/.env if it exists, so the key can live in a file (gitignored)
// instead of having to be typed into a terminal every time.
try {
  process.loadEnvFile(new URL('./.env', import.meta.url));
} catch {
  // No .env - fall through to the environment variable check below.
}

const key = process.env.ANTHROPIC_API_KEY || '';
if (!key || key.includes('paste') || key.endsWith('...')) {
  console.error(
    '\nNo Anthropic API key found.\n' +
      '  1. Get one at https://console.anthropic.com/settings/keys\n' +
      '  2. Open server/.env and paste it after the = sign\n' +
      '  3. Save, then start this again\n',
  );
  process.exit(1);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

// The handler is written against Vercel's req/res shape, so give it one.
function adapt(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  // The browser preview runs on :8081 and this on :3000, so it is a
  // cross-origin request and needs CORS. Wide open is fine for localhost.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cram-key, x-cram-admin, x-cram-tier');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const handler = ROUTES[req.url?.split('?')[0]];
  if (!handler) {
    res.statusCode = 404;
    return res.end('Not found. Try POST /api/generate');
  }

  adapt(res);

  try {
    req.body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const started = Date.now();
  try {
    await handler(req, res);
  } catch (e) {
    console.error('handler threw:', e);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  }
  const tier = req.headers['x-cram-admin'] ? 'admin' : req.headers['x-cram-tier'] || 'free';
  console.log(`${req.method} ${req.url} [${tier}] -> ${res.statusCode} (${Date.now() - started}ms)`);
});

server.listen(PORT, () => {
  console.log(`\nCram API listening on http://localhost:${PORT}`);
  console.log(`Model: ${process.env.CRAM_MODEL || 'claude-opus-5'}`);
  if (!process.env.CRAM_APP_KEY) {
    console.log('CRAM_APP_KEY unset - the shared-secret check is skipped locally.');
  }
  if (!process.env.CRAM_ADMIN_KEY) {
    console.log('CRAM_ADMIN_KEY unset - admin mode cannot be turned on from the app.');
  }
  console.log('');
});
