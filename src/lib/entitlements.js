import { getUsage } from './storage';

// Free users get a real taste, then hit a wall. 10 cards is roughly one
// slide's worth - enough to see it work, not enough to study from.
export const FREE_DAILY_CARDS = 10;

export const PLANS = [
  {
    id: 'cram_weekly',
    label: 'Weekly',
    price: '$3.99',
    period: 'per week',
    note: '1 week free, then $3.99/week',
    trial: true,
    trialDays: 7,
  },
  {
    id: 'cram_semester',
    label: 'Semester Pass',
    price: '$19.99',
    period: '4 months',
    note: 'Covers you to finals',
    badge: 'BEST VALUE',
    highlight: true,
  },
  {
    id: 'cram_annual',
    label: 'Annual',
    price: '$39.99',
    period: 'per year',
    note: 'Works out to $3.33/month',
  },
];

// ---------------------------------------------------------------------------
// Subscription state.
//
// TODO(Taylor): swap this module's body for RevenueCat before submitting.
//   1. npx expo install react-native-purchases
//   2. Purchases.configure({ apiKey: REVENUECAT_IOS_KEY }) in App.js
//   3. isSubscribed()  -> (await Purchases.getCustomerInfo()).entitlements.active.pro != null
//      purchase(planId) -> Purchases.purchasePackage(pkg)
//      restore()        -> Purchases.restorePurchases()
// The product IDs above must match the ones created in App Store Connect.
// Everything else in the app talks to this file and nothing else, so the
// swap is contained to these three functions.
// ---------------------------------------------------------------------------

let subscribed = false;

export async function isSubscribed() {
  return subscribed;
}

export async function purchase(planId) {
  throw new Error(
    `Billing is not wired up yet (plan: ${planId}). See src/lib/entitlements.js.`,
  );
}

export async function restore() {
  throw new Error('Billing is not wired up yet. See src/lib/entitlements.js.');
}

// Documents are Pro-only, for two reasons that happen to agree: a 50-page PDF
// can produce a hundred cards in one shot, which makes a 10-card daily limit
// meaningless, and it is by far the most expensive request we can send.
export async function canUseDocuments() {
  return await isSubscribed();
}

// Subscribers - trial included - are unlimited as far as anyone can tell. This
// ceiling exists only to stop someone taking a free week, running hundreds of
// PDFs through it, and cancelling. A heavy student does 20-30 scans on a bad
// day, so nobody real will ever meet it.
export const FAIR_USE_DAILY_SCANS = 60;

export async function checkQuota() {
  const usage = await getUsage();

  if (await isSubscribed()) {
    const withinFairUse = usage.scans < FAIR_USE_DAILY_SCANS;
    // remaining stays Infinity so the UI keeps showing PRO, not a countdown.
    return { allowed: withinFairUse, remaining: Infinity, fairUse: !withinFairUse };
  }

  const remaining = Math.max(0, FREE_DAILY_CARDS - usage.cards);
  return { allowed: remaining > 0, remaining };
}
