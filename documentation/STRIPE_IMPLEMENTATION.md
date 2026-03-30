# Stripe Payment Implementation

## Overview

Two-tier monetization model using Stripe subscriptions:

- **Free**: 100 API queries/month, hard cutoff with 429 response
- **Unlimited**: $4/month or $30/year, unrestricted API access

Stripe handles checkout, billing, renewals, and cancellation UI. Our webhook keeps `users.planTier` in sync.

---

## Architecture

### Files

| File                                | Purpose                                                                            | Auth             |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `src/routes/api/stripe.checkout.ts` | Creates Stripe Checkout session                                                    | Clerk            |
| `src/routes/api/stripe.webhook.ts`  | Handles Stripe events, updates `planTier`                                          | Stripe signature |
| `src/routes/api/stripe.portal.ts`   | Creates Billing Portal session                                                     | Clerk            |
| `src/server/quota.ts`               | Quota enforcement for API routes                                                   | API key          |
| `src/postgres/schema.ts`            | `users` table (planTier, stripeCustomerId, stripeSubscriptionId), `apiUsage` table | —                |
| `src/lib/env.ts`                    | Stripe env vars                                                                    | —                |
| `src/routes/index.tsx`              | Pricing UI + `handleUpgrade()`                                                     | —                |

### Database Fields

**`users` table:**

```
planTier            text  "free" | "unlimited"  (default: "free")
stripeCustomerId    text  nullable — set on first checkout
stripeSubscriptionId text nullable — set when subscription active
```

**`apiUsage` table** (compound PK: userId + month + endpoint):

```
userId        text     FK → users
month         text     "YYYY-MM"
endpoint      text     e.g. "takeaways.search"
requestCount  integer  atomically incremented per request
```

### Environment Variables

```
STRIPE_SECRET_KEY        sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET    whsec_...
STRIPE_MONTHLY_PRICE_ID  price_... ($4/mo)
STRIPE_ANNUAL_PRICE_ID   price_... ($30/yr)
```

All must be from the same Stripe mode (test or live).

---

## Subscription Lifecycle

```
New user → planTier = "free"
  │
  ├─ Clicks "$4/mo" or "$30/yr" on landing page
  │    └─ POST /api/stripe/checkout { interval: "month" | "year" }
  │         ├─ Get/create Stripe customer, save stripeCustomerId
  │         ├─ Create checkout session with price ID
  │         └─ Return { url } → browser redirects to Stripe
  │
  ├─ Completes payment on Stripe
  │    └─ Webhook: checkout.session.completed
  │         └─ planTier = "unlimited", save stripeSubscriptionId
  │
  ├─ Monthly/annual renewal (automatic)
  │    └─ Webhook: customer.subscription.updated (status=active)
  │         └─ planTier stays "unlimited"
  │
  ├─ Payment fails
  │    └─ Webhook: invoice.payment_failed
  │         └─ planTier = "free"
  │
  └─ User cancels via Billing Portal
       └─ Webhook: customer.subscription.deleted
            └─ planTier = "free", clear stripeSubscriptionId
```

---

## Request Flows

### Upgrade Flow

1. User clicks "$4/mo" or "$30/yr" button on landing page
2. `handleUpgrade()` POSTs to `/api/stripe/checkout` with `{ interval }`
3. Endpoint authenticates via Clerk, creates/reuses Stripe customer
4. `stripeCustomerId` saved to DB immediately (so webhook can match)
5. Checkout session created, URL returned
6. Browser redirects to Stripe Checkout
7. After payment, Stripe redirects to `/account/api-keys?checkout=success`
8. Webhook fires `checkout.session.completed` → `planTier = "unlimited"`

### API Request Flow (Quota Check)

```
API request with Bearer token
  → authorizeApiRequest(request, "takeaways.search")
    → authenticate(request)          // validate API key
    → checkAndIncrementQuota(userId, endpoint)
      → Atomic UPSERT into apiUsage (increment requestCount)
      → If "unlimited": allowed (still tracked for analytics)
      → If "free": SUM all endpoints for month
        → total > 100 → 429 response
        → total ≤ 100 → allowed, return remaining
```

### Cancellation Flow

1. User clicks "Manage subscription" → POST `/api/stripe/portal`
2. Endpoint creates Billing Portal session, returns URL
3. Browser redirects to Stripe-hosted portal
4. User cancels → access continues until period ends
5. Period ends → Stripe fires `customer.subscription.deleted`
6. Webhook sets `planTier = "free"`, clears `stripeSubscriptionId`

---

## Webhook Events

| Event                           | Trigger                      | Action                                                     |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `checkout.session.completed`    | User completes checkout      | `planTier = "unlimited"`, save customer + subscription IDs |
| `customer.subscription.updated` | Renewal, plan change         | If status=`active`: keep `planTier = "unlimited"`          |
| `customer.subscription.deleted` | Cancellation (end of period) | `planTier = "free"`, clear `stripeSubscriptionId`          |
| `invoice.payment_failed`        | Card declined                | `planTier = "free"`                                        |

User matching: primary lookup by `stripeCustomerId`, fallback to `client_reference_id` (userId) on checkout events.

Webhook signature verified via `stripe.webhooks.constructEvent()` with raw request body.

---

## Stripe Dashboard Setup

1. **Products**: Create one product with two prices ($4/mo recurring, $30/yr recurring)
2. **Webhook endpoint**: `https://<domain>/api/stripe/webhook` listening for the 4 events above
3. **Billing Portal**: Enable in Stripe Dashboard settings (allows cancel, payment method update)
4. **Test mode**: Use `sk_test_` keys + test price IDs for development; switch to `sk_live_` for production

Test card: `4242 4242 4242 4242` (any future expiry, any CVC)

---

## Key Design Decisions

- **`stripeCustomerId` saved in checkout endpoint** (not just webhook) — prevents race condition where webhook fires before checkout response is processed
- **Atomic counter increment** — SQL `ON CONFLICT DO UPDATE` prevents miscounts from concurrent requests
- **Unlimited users still tracked** — enables future usage dashboard without data gaps
- **Quota is global, not per-endpoint** — 100 total queries/month across all endpoints combined
- **Stripe Billing Portal for cancellation** — no custom cancellation UI needed
