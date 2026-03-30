import { describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";
import {
  handleStripeEvent,
  type StripeEventRepo,
  type UserRecord,
} from "./stripe-events";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user_1",
    planTier: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    ...overrides,
  };
}

function makeEvent(type: string, data: Record<string, unknown>): Stripe.Event {
  return { type, data: { object: data } } as unknown as Stripe.Event;
}

function createFakeRepo(usersData: UserRecord[]): {
  repo: StripeEventRepo;
  getUser: (id: string) => UserRecord | undefined;
} {
  const repo: StripeEventRepo = {
    findUserByCustomerId: vi.fn((customerId: string) =>
      Promise.resolve(
        usersData.find((u) => u.stripeCustomerId === customerId) ?? null,
      ),
    ),
    findUserById: vi.fn((id: string) =>
      Promise.resolve(usersData.find((u) => u.id === id) ?? null),
    ),
    updateUserById: vi.fn((id: string, data: Record<string, unknown>) => {
      const user = usersData.find((u) => u.id === id);
      if (user) Object.assign(user, data);
      return Promise.resolve();
    }),
    updateUserByCustomerId: vi.fn(
      (customerId: string, data: Record<string, unknown>) => {
        const user = usersData.find((u) => u.stripeCustomerId === customerId);
        if (user) Object.assign(user, data);
        return Promise.resolve();
      },
    ),
  };
  return {
    repo,
    getUser: (id: string) => usersData.find((u) => u.id === id),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("handleStripeEvent", () => {
  describe("checkout.session.completed", () => {
    // User already has a stripeCustomerId — webhook should match by customer,
    // flip planTier to unlimited, and persist both Stripe IDs.
    test("upgrades user to unlimited and saves IDs", async () => {
      const user = makeUser({ stripeCustomerId: "cus_123" });
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("checkout.session.completed", {
          customer: "cus_123",
          subscription: "sub_456",
          client_reference_id: "user_1",
        }),
        repo,
      );

      expect(getUser("user_1")).toMatchObject({
        planTier: "unlimited",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_456",
      });
    });

    // First-time checkout: the user has no stripeCustomerId yet, so the
    // customer lookup returns null. The handler should fall back to matching
    // by client_reference_id (our internal userId) set during checkout creation.
    test("falls back to client_reference_id when customer lookup fails", async () => {
      const user = makeUser(); // no stripeCustomerId
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("checkout.session.completed", {
          customer: "cus_new",
          subscription: "sub_789",
          client_reference_id: "user_1",
        }),
        repo,
      );

      expect(getUser("user_1")).toMatchObject({
        planTier: "unlimited",
        stripeCustomerId: "cus_new",
        stripeSubscriptionId: "sub_789",
      });
    });

    // If neither stripeCustomerId nor client_reference_id resolve to a user
    // (e.g. orphaned Stripe customer), the handler should silently skip —
    // no DB update, no error — so Stripe gets a 200 and stops retrying.
    test("is a no-op when no user is found", async () => {
      const { repo } = createFakeRepo([]);

      await handleStripeEvent(
        makeEvent("checkout.session.completed", {
          customer: "cus_unknown",
          subscription: "sub_000",
          client_reference_id: "user_missing",
        }),
        repo,
      );

      expect(repo.updateUserById).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.updated", () => {
    // Renewals and plan changes fire this event with status "active".
    // The handler should keep planTier unlimited, update the subscription ID
    // (it may change on plan switch), and reset paymentStatus to "ok"
    // (clears any prior past_due from a failed invoice).
    test("keeps user unlimited when status is active", async () => {
      const user = makeUser({
        planTier: "unlimited",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_old",
      });
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("customer.subscription.updated", {
          id: "sub_renewed",
          status: "active",
          customer: "cus_123",
        }),
        repo,
      );

      expect(getUser("user_1")).toMatchObject({
        planTier: "unlimited",
        stripeSubscriptionId: "sub_renewed",
        paymentStatus: "ok",
      });
    });

    // Stripe also fires subscription.updated for non-active statuses like
    // "past_due" or "canceled". We should NOT touch the user record in those
    // cases — other event types (invoice.payment_failed, subscription.deleted)
    // handle those transitions.
    test("does not update when status is not active", async () => {
      const user = makeUser({
        planTier: "unlimited",
        stripeCustomerId: "cus_123",
      });
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("customer.subscription.updated", {
          id: "sub_123",
          status: "past_due",
          customer: "cus_123",
        }),
        repo,
      );

      expect(repo.updateUserByCustomerId).not.toHaveBeenCalled();
      expect(getUser("user_1")?.planTier).toBe("unlimited");
    });
  });

  describe("customer.subscription.deleted", () => {
    // Fires at the end of a canceled subscription's billing period.
    // The user should be downgraded to free, stripeSubscriptionId cleared
    // (no active sub), and paymentStatus reset to "ok".
    test("downgrades to free and clears subscription ID", async () => {
      const user = makeUser({
        planTier: "unlimited",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_456",
      });
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("customer.subscription.deleted", {
          id: "sub_456",
          customer: "cus_123",
        }),
        repo,
      );

      expect(getUser("user_1")).toMatchObject({
        planTier: "free",
        stripeSubscriptionId: null,
        paymentStatus: "ok",
      });
    });
  });

  describe("invoice.payment_failed", () => {
    // Card declined on renewal. We flag the user as past_due but keep
    // planTier unlimited — Stripe retries payment before eventually deleting
    // the subscription, which is when we actually downgrade.
    test("sets paymentStatus to past_due", async () => {
      const user = makeUser({
        planTier: "unlimited",
        stripeCustomerId: "cus_123",
      });
      const { repo, getUser } = createFakeRepo([user]);

      await handleStripeEvent(
        makeEvent("invoice.payment_failed", { customer: "cus_123" }),
        repo,
      );

      expect(getUser("user_1")).toMatchObject({
        planTier: "unlimited",
        paymentStatus: "past_due",
      });
    });

    // Edge case: some invoice events can have a null customer (e.g. one-off
    // invoices not tied to a customer). We should skip rather than crash.
    test("is a no-op when customer ID is missing", async () => {
      const { repo } = createFakeRepo([]);

      await handleStripeEvent(
        makeEvent("invoice.payment_failed", { customer: null }),
        repo,
      );

      expect(repo.updateUserByCustomerId).not.toHaveBeenCalled();
    });
  });

  // Stripe sends many event types we don't handle (e.g. payment_intent.*).
  // The handler should ignore them gracefully so the webhook always returns 200.
  test("unknown event type does not throw", async () => {
    const { repo } = createFakeRepo([]);

    await expect(
      handleStripeEvent(makeEvent("some.unknown.event", {}), repo),
    ).resolves.toBeUndefined();
  });
});
