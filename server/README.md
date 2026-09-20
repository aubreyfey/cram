# Cram API

Three endpoints. `/api/generate` takes a base64 JPEG of a page, a PDF, up to
20 JPEGs as `{ pages: [...] }`, or pasted notes as `{ text }`, and returns
flashcards. `/api/admin` checks the admin code. `/api/feedback` takes in-app
feedback. `/api/explain` answers "why?" for one card. `/api/guide` writes a study
guide for an exam from its cards. `/api/youtube` fetches a video's captions
when YouTube allows it (best effort - the app has a paste fallback).

The Anthropic API key lives here and **never** ships inside the app. That is the
only reason this server exists.

## Deploy

```bash
cd server
npm install
npx vercel            # first run links the project
npx vercel --prod
```

Set these in the Vercel dashboard (Settings -> Environment Variables):

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `CRAM_APP_KEY` | any long random string; must match `extra.appKey` in `app.json` |
| `CRAM_MODEL` | `claude-opus-5` — for subscribers and admins (see cost note below) |
| `CRAM_MODEL_FREE` | `claude-haiku-4-5-20251001` — for free-tier scans |
| `CRAM_MODEL_GUIDE` | optional; model for study guides. Defaults to `CRAM_MODEL` for paid, the free model otherwise |
| `CRAM_MODEL_EXPLAIN` | optional; model for "Why?" explanations. Defaults to the free model - a few hundred tokens, Haiku is plenty |
| `FEEDBACK_GITHUB_TOKEN` | optional; a fine-grained token with Issues: write on the repo below |
| `FEEDBACK_GITHUB_REPO` | optional; `owner/name` — in-app feedback lands there as issues. Use a **private** repo; people type their email in. Unset = feedback goes to the function logs. |
| `CRAM_ADMIN_KEY` | any long random string; the code you type into the app to turn on admin mode |

`CRAM_ADMIN_KEY` is checked by `POST /api/admin` and, as the `x-cram-admin`
header, lets a request skip the per-IP rate limit. It never ships in the app.
Leave it unset and admin mode simply cannot be turned on.

Then put the deployed URL into `app.json` -> `extra.apiBaseUrl`.

## Local (no Vercel account needed)

The fastest way to get a working scan. All you need is an Anthropic key.

```powershell
cd server
npm install
$env:ANTHROPIC_API_KEY = "sk-ant-..."
node local.js
```

That serves the same handler on `http://localhost:3000`, with CORS open so the
browser preview on `:8081` can reach it.

Then set `extra.apiBaseUrl` in `app.json`:

| Testing on | Set it to |
|---|---|
| Browser preview | `http://localhost:3000` |
| Your phone | `http://<your-laptop-lan-ip>:3000` |

On a phone, `localhost` means the phone itself — it must be the laptop's LAN
address, and both devices must be on the same wifi.

`npx vercel dev` also works if you'd rather use the Vercel CLI, but it needs an
account and adds nothing for local testing.

## What it costs to run

Measured against `claude-opus-5` at $5/$25 per million tokens, one scan of a
1400px-wide page is roughly:

| | tokens | cost |
|---|---|---|
| image + system prompt | ~3,900 in | $0.020 |
| cards + thinking | ~1,400 out | $0.035 |
| **per scan** | | **~$0.055** |

At $3.99/week (Apple takes 15% under the Small Business Program, so ~$3.39 net)
a subscriber scanning 20 pages a week costs about $1.10 — a healthy margin. A
heavy user at 60 scans a week costs $3.30 and is close to break-even.

**The free tier is the real exposure.** 10 free cards/day is roughly one scan a
day, so a free user who never converts would cost about **$1.65/month** on
Opus. A few thousand of those and the bill is the biggest line in the business.

So the model is picked **per tier**. The app sends `x-cram-tier: free|pro`;
subscribers and admins get `CRAM_MODEL`, everyone else gets `CRAM_MODEL_FREE`:

| Variable | Default | Cost per scan |
|---|---|---|
| `CRAM_MODEL` (paid + admin) | `claude-opus-5` | ~$0.055 |
| `CRAM_MODEL_FREE` | `claude-haiku-4-5-20251001` | ~$0.011 |

That puts a free user at about **$0.33/month** — and the free user who writes
or pastes their own cards costs nothing at all. The tier header is a cost
switch, not a security boundary: forging it gets a better model for the same
10 cards a day. Real enforcement is receipt verification (below).

Other levers, if you still need them: drop the free tier to 5 cards/day, or
set `CRAM_MODEL_FREE=claude-sonnet-5` (~$0.022) if Haiku's cards on messy
handwriting are not good enough. Watch spend at console.anthropic.com and set
a billing alert **before** you post the launch video, not after.

## Security — read this before you scale

The `x-cram-key` header ships inside the app binary. Anyone willing to run
`strings` on the IPA can pull it and hit this endpoint on your bill. The IP rate
limit helps a little, but serverless instances do not share memory, so it only
catches the naive case.

That is an acceptable risk for a launch with a few hundred users. It is not
acceptable at a few thousand. Before then, do one of:

- **App Attest** (`expo-apple-authentication` / DeviceCheck) so only real
  installs of your app can call the endpoint, or
- **verify the RevenueCat receipt** server-side and only serve subscribers,
  moving free-tier generation behind a signed device token.

Set a hard spend cap on the Anthropic account either way.
