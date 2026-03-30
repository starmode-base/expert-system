import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { db as dbInstance } from "~/postgres/db";
import type { users as usersTable } from "~/postgres/schema";

type Db = typeof dbInstance;
type UsersTable = typeof usersTable;

export interface UserRecord {
  id: string;
  planTier: "free" | "unlimited";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface StripeEventRepo {
  findUserByCustomerId: (customerId: string) => Promise<UserRecord | null>;
  findUserById: (id: string) => Promise<UserRecord | null>;
  updateUserById: (id: string, data: Record<string, unknown>) => Promise<void>;
  updateUserByCustomerId: (
    customerId: string,
    data: Record<string, unknown>,
  ) => Promise<void>;
}

export function createDrizzleRepo(db: Db, users: UsersTable): StripeEventRepo {
  return {
    findUserByCustomerId: async (customerId) => {
      const user = await db.query.users.findFirst({
        where: eq(users.stripeCustomerId, customerId),
      });
      return user
        ? {
            id: user.id,
            planTier: user.planTier,
            stripeCustomerId: user.stripeCustomerId,
            stripeSubscriptionId: user.stripeSubscriptionId,
          }
        : null;
    },
    findUserById: async (id) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      return user
        ? {
            id: user.id,
            planTier: user.planTier,
            stripeCustomerId: user.stripeCustomerId,
            stripeSubscriptionId: user.stripeSubscriptionId,
          }
        : null;
    },
    updateUserById: async (id, data) => {
      await db.update(users).set(data).where(eq(users.id, id));
    },
    updateUserByCustomerId: async (customerId, data) => {
      await db
        .update(users)
        .set(data)
        .where(eq(users.stripeCustomerId, customerId));
    },
  };
}

export async function handleStripeEvent(
  event: Stripe.Event,
  repo: StripeEventRepo,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const clientRefId = session.client_reference_id;

      let user = customerId
        ? await repo.findUserByCustomerId(customerId)
        : null;

      if (!user && clientRefId) {
        user = await repo.findUserById(clientRefId);
      }

      if (user) {
        await repo.updateUserById(user.id, {
          planTier: "unlimited",
          stripeCustomerId: customerId ?? user.stripeCustomerId,
          stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      if (subscription.status === "active") {
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        await repo.updateUserByCustomerId(customerId, {
          planTier: "unlimited",
          stripeSubscriptionId: subscription.id,
          paymentStatus: "ok",
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      await repo.updateUserByCustomerId(customerId, {
        planTier: "free",
        stripeSubscriptionId: null,
        paymentStatus: "ok",
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      if (customerId) {
        await repo.updateUserByCustomerId(customerId, {
          paymentStatus: "past_due",
        });
      }
      break;
    }
  }
}
