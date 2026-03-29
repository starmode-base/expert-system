# Monetization: Free vs Unlimited Tiers

## Context
Expert-System is an API-first research tool for AI agents. Currently there is no monetization — API keys are free with no usage limits. The goal is to add two tiers:
- **Free**: 100 queries/month, hard cutoff with 429 response
- **Unlimited**: $4/month or $30/year via Stripe, unrestricted API access

Implementation is split into four phases. Phase 1 (usage tracking + enforcement) has no external dependencies and can ship immediately. Phase 2 (Stripe) is scaffolded now and wired up once Stripe credentials are available. Phase 3 wires the existing pricing UI to Stripe checkout. Phase 4 adds a usage dashboard.

---

## Phase 1 — Schema + Usage Enforcement

### 1. Schema changes (`src/postgres/schema.ts`)

**Add `planTier` to `users` table:**
```ts
planTier: text().$type<"free" | "unlimited">().notNull().default("free"),
```

**Add `apiUsage` table (new, at end of file):**
```ts
export const apiUsage = pgTable(
  "api_usage",
  {
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    month: text().notNull(), // "YYYY-MM"
    endpoint: text().notNull(), // e.g. "takeaways.search", "documents", "query.macro"
    requestCount: integer().notNull().default(0),
    createdAt: createdAtField,
    updatedAt: updatedAtField,
  },
  (table) => [primaryKey({ columns: [table.userId, table.month, table.endpoint] })],
);
export type ApiUsageSelect = typeof apiUsage.$inferSelect;
```

### 2. Relations (`src/postgres/relations.ts`)

Add `apiUsage` import and wire to users:
- Add `apiUsage: many(apiUsage)` to `usersRelations`
- Add new `apiUsageRelations` with `one(users)` pointing back

### 3. New file: `src/server/quota.ts`

Central quota logic. Exports one function used by all REST routes:

```ts
const FREE_TIER_LIMIT = 100;

// Atomically increments the per-endpoint monthly counter and checks the total across all endpoints.
// Unlimited users still get tracked (for the dashboard) but skip the limit check.
export async function checkAndIncrementQuota(
  userId: string,
  endpoint: string,
): Promise<{ allowed: boolean; remaining: number }>

// Wraps authenticate() + checkAndIncrementQuota().
// Returns { type: "ok", userId } or { type: "error", response: Response (401 | 429) }
export async function authorizeApiRequest(
  request: Request,
  endpoint: string,
): Promise<{ type: "ok"; userId: string } | { type: "error"; response: Response }>
```

**Endpoint identifiers** (passed by each route):
| Route file | `endpoint` value |
|---|---|
| `v1.takeaways.search.ts` | `"takeaways.search"` |
| `v1.takeaways.ts` | `"takeaways"` |
| `v1.takeaways.recent.ts` | `"takeaways.recent"` |
| `v1.documents.ts` | `"documents"` |
| `v1.query.macro.ts` | `"query.macro"` |
| `v1.query.financial.ts` | `"query.financial"` |
| `v1.research.ts` | `"research"` |

**Quota logic:**
1. Fetch `user.planTier` from db
2. Upsert into `api_usage` for this endpoint with atomic increment:
   ```sql
   INSERT INTO api_usage (user_id, month, endpoint, request_count)
   VALUES ($userId, $month, $endpoint, 1)
   ON CONFLICT (user_id, month, endpoint)
   DO UPDATE SET request_count = api_usage.request_count + 1
   ```
3. If `"unlimited"` → return `{ allowed: true, remaining: Infinity }` (still tracked above for dashboard)
4. Otherwise, SUM total for the month:
   ```sql
   SELECT COALESCE(SUM(request_count), 0) AS total
   FROM api_usage WHERE user_id = $userId AND month = $month
   ```
5. If `total > 100` → `allowed: false`

**429 response shape:**
```json
{ "error": "Monthly quota exceeded. Upgrade to Unlimited at expert-system.com/pricing." }
```
Headers: `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 0`

### 4. Update all REST API routes

Replace the current two-line auth pattern in each file:
```ts
// Before
const userId = await authenticate(request);
if (!userId) return apiError("Unauthorized", 401);

// After
const auth = await authorizeApiRequest(request, "takeaways.search");
if (auth.type === "error") return auth.response;
const { userId } = auth;
```

Files to update:
- `src/routes/api/v1.takeaways.search.ts`
- `src/routes/api/v1.takeaways.ts`
- `src/routes/api/v1.takeaways.recent.ts`
- `src/routes/api/v1.documents.ts`
- `src/routes/api/v1.query.macro.ts`
- `src/routes/api/v1.query.financial.ts`
- `src/routes/api/v1.research.ts`

### 5. Apply schema changes
```bash
bun run db:push
```

---

## Phase 2 — Stripe Subscription

### 1. Install Stripe SDK
```bash
bun add stripe
```

### 2. Env vars (`src/lib/env.ts`)

Add to `rawEnv`:
```ts
STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID, // $4/mo price ID from Stripe dashboard
STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID,   // $30/yr price ID from Stripe dashboard
```

### 3. Schema additions (`src/postgres/schema.ts`)

Add to `users` table:
```ts
stripeCustomerId: text(),        // nullable
stripeSubscriptionId: text(),    // nullable
```

### 4. New file: `src/routes/api/stripe.checkout.ts`

POST endpoint. Creates a Stripe Checkout session and returns the URL.
- Requires Clerk auth (not API key auth — this is a UI action)
- Accepts `{ interval: "month" | "year" }` in the request body to select billing cadence
- Creates or retrieves Stripe customer linked to `user.stripeCustomerId`
- **On create:** saves `stripeCustomerId` to the user row immediately, before redirecting — this ensures the webhook can match the customer back to the user
- Creates checkout session with the corresponding price ID (`STRIPE_MONTHLY_PRICE_ID` or `STRIPE_ANNUAL_PRICE_ID`), success/cancel URLs, and `client_reference_id: userId` as a fallback lookup key
- Returns `{ url: string }`

### 5. New file: `src/routes/api/stripe.webhook.ts`

POST endpoint. **Note:** Stripe signature verification requires the raw request body. Ensure this route reads the body as text/buffer before any JSON parsing — TanStack Start / Vinxi may auto-parse otherwise.

Handles Stripe webhook events:
- `checkout.session.completed` → look up user by `client_reference_id` (fallback) or `stripeCustomerId`, save `stripeCustomerId` if not already set, store `stripeSubscriptionId`
- `customer.subscription.created` + `customer.subscription.updated` (status=`active`) → set `planTier = "unlimited"`, store `stripeSubscriptionId`
- `customer.subscription.deleted` + `invoice.payment_failed` → set `planTier = "free"`, clear `stripeSubscriptionId`
- Verifies webhook signature with `STRIPE_WEBHOOK_SECRET`
- Matches Stripe customer to user via `stripeCustomerId`, with fallback to `client_reference_id` on checkout events (covers the edge case where the webhook fires before the checkout endpoint has saved the customer ID)

### 6. New file: `src/routes/api/stripe.portal.ts`

POST endpoint. Creates a Stripe Billing Portal session so users can manage/cancel their subscription.
- Requires Clerk auth
- Looks up `user.stripeCustomerId` — returns 400 if none exists
- Creates a portal session with `return_url` pointing back to the account page
- Returns `{ url: string }`

This lets users cancel, update payment methods, and view invoices without you building custom UI for any of it.

---

## Phase 3 — Pricing Page

### `src/routes/index.tsx`

The pricing section already exists on the landing page. Update the "Upgrade" CTA on the Unlimited card to POST `/api/stripe/checkout` and redirect to Stripe. Add a month/year toggle or keep both prices visible as currently shown ($4/mo or $30/yr).

---

## Phase 4 — Usage Dashboard

### 1. New server query: `src/server/usage.ts`

Exports functions to query the `apiUsage` table for the authenticated user:

```ts
// Returns total queries and per-endpoint breakdown for a given month (defaults to current).
export async function getUsageSummary(
  userId: string,
  month?: string, // "YYYY-MM", defaults to current month
): Promise<{
  month: string;
  total: number;
  limit: number | null; // null for unlimited users
  endpoints: { endpoint: string; count: number }[];
}>
```

**Query:**
```sql
SELECT endpoint, request_count
FROM api_usage
WHERE user_id = $userId AND month = $month
ORDER BY request_count DESC
```

Sum `request_count` in application code for the `total`. Look up `user.planTier` to determine `limit` (100 or null).

### 2. New server function: `src/routes/account/usage.tsx`

New route at `/account/usage`. Uses a `createServerFn` to call `getUsageSummary` for the current Clerk user.

**UI:**
- **Summary bar** at top: "X / 100 queries used" (free) or "X queries this month" (unlimited) with a progress bar (free only)
- **Endpoint breakdown table**: rows for each endpoint showing name and count, sorted by count descending. Simple `<table>` with endpoint name and request count columns.
- **Month selector**: dropdown or left/right arrows to view previous months' usage

### 3. Link from account nav

Add a "Usage" link to the account navigation (wherever API keys and API docs are linked) pointing to `/account/usage`.

---

## Critical Files

| File | Change |
|---|---|
| `src/postgres/schema.ts` | Add `planTier` to users; add `apiUsage` table; add Stripe fields to users (Phase 2) |
| `src/postgres/relations.ts` | Add `apiUsage` relation to users |
| `src/lib/env.ts` | Add Stripe env vars (Phase 2) |
| `src/server/quota.ts` | **NEW** — quota logic + `authorizeApiRequest` |
| `src/routes/api/v1.*.ts` (7 files) | Replace `authenticate` with `authorizeApiRequest` |
| `src/routes/api/stripe.checkout.ts` | **NEW** — Stripe checkout session (Phase 2) |
| `src/routes/api/stripe.webhook.ts` | **NEW** — Stripe webhook handler (Phase 2) |
| `src/routes/api/stripe.portal.ts` | **NEW** — Stripe billing portal session (Phase 2) |
| `src/routes/index.tsx` | Wire existing pricing CTA to Stripe checkout |
| `src/server/usage.ts` | **NEW** — usage query functions (Phase 3) |
| `src/routes/account/usage.tsx` | **NEW** — usage dashboard page (Phase 3) |

## Reuse
- `authenticate()` from `src/server/api-keys.ts` — call inside `authorizeApiRequest`
- `db`, `schema` from `~/postgres/db` — standard import pattern
- `ensureEnv()` from `~/lib/env` — for Stripe keys
- `apiError` local helper already in each route file — reuse same pattern for 429

## Verification

1. **Phase 1**: Create a free user, make 100 API calls, verify 101st returns `429` with correct body and headers. Make 1 call as unlimited user, verify it passes.
2. **Phase 2**: Use Stripe test mode, complete checkout flow, verify `planTier` flips to `"unlimited"` in DB. Cancel subscription, verify it flips back to `"free"`.
3. **Phase 3**: Verify "Upgrade" button on pricing card initiates Stripe checkout redirect (both monthly and annual).
4. **Billing portal**: As a subscribed user, verify portal link opens Stripe-hosted page. Cancel subscription via portal, verify webhook flips `planTier` back to `"free"`.
5. **Usage dashboard**: Make several API calls across different endpoints. Visit `/account/usage`, verify total matches and per-endpoint breakdown is correct. Switch months and verify historical data displays.
