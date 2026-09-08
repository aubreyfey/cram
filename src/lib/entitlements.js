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
    note: '3 days free, then $3.99/week',
    trial: true,
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

export async function checkQuota() {
  if (await isSubscribed()) return { allowed: true, remaining: Infinity };
  const usage = await getUsage();
  const remaining = Math.max(0, FREE_DAILY_CARDS - usage.cards);
  return { allowed: remaining > 0, remaining };
}
