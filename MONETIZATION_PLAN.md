# Monetization: Free vs Unlimited Tiers

## Context
Expert-System is an API-first research tool for AI agents. Currently there is no monetization — API keys are free with no usage limits. The goal is to add two tiers:
- **Free**: 100 queries/month, hard cutoff with 429 response
- **Unlimited**: $3.99/month via Stripe, unrestricted API access

Implementation is split into two phases. Phase 1 (usage tracking + enforcement) has no external dependencies and can ship immediately. Phase 2 (Stripe) is scaffolded now and wired up once Stripe credentials are available.

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
    requestCount: integer().notNull().default(0),
    createdAt: createdAtField,
    updatedAt: updatedAtField,
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
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

// Atomically increments monthly usage counter and returns whether the request is allowed.
// Unlimited users skip the counter entirely.
export async function checkAndIncrementQuota(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }>

// Wraps authenticate() + checkAndIncrementQuota().
// Returns { type: "ok", userId } or { type: "error", response: Response (401 | 429) }
export async function authorizeApiRequest(
  request: Request,
): Promise<{ type: "ok"; userId: string } | { type: "error"; response: Response }>
```

**Quota logic:**
1. Fetch `user.planTier` from db
2. If `"unlimited"` → return `{ allowed: true, remaining: Infinity }`
3. Otherwise upsert into `api_usage` with atomic increment:
   ```sql
   INSERT INTO api_usage (user_id, month, request_count) VALUES ($userId, $month, 1)
   ON CONFLICT (user_id, month) DO UPDATE SET request_count = api_usage.request_count + 1
   RETURNING request_count
   ```
4. If `requestCount > 100` → `allowed: false`

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
const auth = await authorizeApiRequest(request);
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
STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID, // $3.99/mo price ID from Stripe dashboard
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
- Creates or retrieves Stripe customer linked to `user.stripeCustomerId`
- Creates checkout session with `STRIPE_PRICE_ID`, success/cancel URLs
- Returns `{ url: string }`

### 5. New file: `src/routes/api/stripe.webhook.ts`

POST endpoint. Handles Stripe webhook events:
- `customer.subscription.created` + `customer.subscription.updated` (status=`active`) → set `planTier = "unlimited"`, store `stripeSubscriptionId`
- `customer.subscription.deleted` + `invoice.payment_failed` → set `planTier = "free"`
- Verifies webhook signature with `STRIPE_WEBHOOK_SECRET`
- Matches Stripe customer to user via `stripeCustomerId`

---

## Phase 3 — Pricing Page

### `src/routes/index.tsx`

Add a `PricingSection` component between "Get started in 30 seconds" and the footer links. Two side-by-side cards:

**Free card:**
- $0/month
- 100 API queries/month
- Full shared corpus access
- CTA: "Get started" → `/account/api-keys`

**Unlimited card** (highlighted):
- $3.99/month
- Unlimited API queries
- Full shared corpus access
- CTA: "Subscribe" → POST `/api/stripe/checkout` then redirect to Stripe

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
| `src/routes/index.tsx` | Add pricing section |

## Reuse
- `authenticate()` from `src/server/api-keys.ts` — call inside `authorizeApiRequest`
- `db`, `schema` from `~/postgres/db` — standard import pattern
- `ensureEnv()` from `~/lib/env` — for Stripe keys
- `apiError` local helper already in each route file — reuse same pattern for 429

## Verification

1. **Phase 1**: Create a free user, make 100 API calls, verify 101st returns `429` with correct body and headers. Make 1 call as unlimited user, verify it passes.
2. **Phase 2**: Use Stripe test mode, complete checkout flow, verify `planTier` flips to `"unlimited"` in DB. Cancel subscription, verify it flips back to `"free"`.
3. **Phase 3**: Visit landing page, verify pricing cards render. Verify "Subscribe" button initiates Stripe checkout redirect.
