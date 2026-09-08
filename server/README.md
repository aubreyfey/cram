# Cram API

One endpoint. Takes a base64 JPEG of a page, returns flashcards.

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
| `CRAM_MODEL` | `claude-opus-5` (see cost note below) |

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
day, so a free user who never converts costs about **$1.65/month**. A few
thousand of those and the bill is the biggest line in the business.

Three levers, in the order you should pull them:

1. **Drop the free tier to 5 cards/day.** Costs nothing, halves the exposure.
2. **Switch `CRAM_MODEL` to `claude-sonnet-5`** ($2/$10) — about $0.022/scan,
   2.5x cheaper. Check card quality on a dozen real pages first, especially
   messy handwriting.
3. **`claude-haiku-4-5`** ($1/$5) — about $0.011/scan. Cheapest, and the one
   most likely to cost you quality on hard pages.

It is one environment variable, so you can A/B it after launch rather than
guessing now. Watch spend at console.anthropic.com and set a billing alert
**before** you post the launch video, not after.

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
