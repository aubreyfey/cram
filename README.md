# Cram

Point your phone at a lecture slide, a textbook page, or your own handwriting - or
import a PDF, a screenshot, or a photo you already have.
Get flashcards in about three seconds.

Expo / React Native, iOS-first. The whole product is one gesture: **shutter →
cards**. Everything else in the app is in service of that, and anything that
gets in front of it is a bug.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. The camera does not work in the
iOS Simulator — you need a real device.

The app talks to a small proxy that holds the Anthropic API key. Set it up
first (`server/README.md`), then put its URL in `app.json` → `extra.apiBaseUrl`.
Without it the scan button will fail with a network error.

## Layout

```
App.js                     screen state machine
src/theme.js               all colors, type, motion — nothing hardcoded elsewhere
src/screens/
  CameraScreen.js          opens straight to camera, no home screen
  GeneratingScreen.js      the 2-4s wait, narrated
  StudyScreen.js           card stack + rating
  LibraryScreen.js         saved decks
  PaywallScreen.js         three plans
src/components/
  Flashcard.js             tap to flip, swipe to rate
  PrimaryButton.js
src/lib/
  api.js                   resize, upload, parse
  storage.js               decks + daily free-tier meter (AsyncStorage)
  srs.js                   trimmed SM-2 scheduling
  entitlements.js          plans + the RevenueCat seam  ← see TODO
server/api/generate.js     the Claude call
```

## Before the App Store — what is still open

**1. Billing is not wired up.** `src/lib/entitlements.js` has working plan
definitions and quota logic, but `purchase()` and `restore()` throw. The file
has step-by-step notes at the top. Roughly:

```bash
npx expo install react-native-purchases
```

Create these products in App Store Connect, then the matching offering in
RevenueCat. The IDs must match `PLANS` exactly:

| Product ID | Type | Price |
|---|---|---|
| `cram_weekly` | Auto-renewing weekly | $3.99, 1-week free trial |
| `cram_semester` | Non-renewing, 4 months | $19.99 |
| `cram_annual` | Auto-renewing yearly | $39.99 |

**2. Icon and splash** are still the Expo placeholders in `assets/`.

**3. Terms and privacy URLs** in `PaywallScreen.js` point at `cram.app`, which
does not exist yet. Apple rejects subscription apps without working links —
this is the single most common rejection reason for this app category, so do
not leave it to the submission.

**4. The app key is a placeholder.** `app.json` → `extra.appKey` and the
server's `CRAM_APP_KEY` both say `change-me`. They have to match.

## Submitting

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios
```

You do not need a Mac for this. You do need an Apple Developer account ($99/yr)
and, before the first build, `eas build:configure`.

Apple's review notes should say the app requires the camera and give them a
photo of a textbook page to point it at — reviewers reject scan apps they can't
figure out how to test.

## What's free and what isn't

| | Free | Pro (trial included) |
|---|---|---|
| Camera capture | ✓ | ✓ |
| Photo library import | ✓ | ✓ |
| **PDF / document import** | — | ✓ |
| Cards per day | 10 | unlimited |

The one-week trial is **full Pro** — unlimited cards and PDFs — because
RevenueCat reports the `pro` entitlement as active for the whole trial period.
A trial user is a Pro user until they cancel.

Behind that sits `FAIR_USE_DAILY_SCANS` (60/day), which exists solely to stop
someone taking a free week, running hundreds of PDFs through it, and
cancelling. A heavy student does 20–30 scans on a bad day, so nobody real will
meet it, and the UI never shows a countdown — subscribers just see `PRO`. If it
does trip, they get a note, never the paywall they already bought.

**PDF import is deliberately Pro-only.** Two reasons that happen to agree: a
50-page PDF can produce a hundred cards in a single request, which makes a
10-card daily limit meaningless; and it is by far the most expensive call we
send. Gating it also gives the paywall something concrete to sell rather than
just "more of the same". The check lives in `canUseDocuments()` in
`src/lib/entitlements.js` — one function if you want to change the policy.

## Design rules

Worth keeping, because the design is the marketing here — the launch is a
15-second screen recording, and if it doesn't read muted, it doesn't work.

- **Camera opens on launch.** No home screen, no onboarding, no sign-in.
- **Three seconds, shutter to first card.** If the real number climbs, cut the
  work, don't add a nicer spinner.
- **One accent color.** Acid lime on near-black, and nothing else competes.
- **Every interaction gets haptics.** It's most of why the thing feels physical.
- **Motion comes from three springs** in `theme.js`. Don't add a fourth.
