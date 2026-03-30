import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "~/postgres/db";
import { users } from "~/postgres/schema";
import { ensureEnv } from "~/lib/env";

export const APIRoute = createAPIFileRoute("/api/stripe/webhook")({
  POST: async ({ request }) => {
    const stripe = new Stripe(ensureEnv("STRIPE_SECRET_KEY"));
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        ensureEnv("STRIPE_WEBHOOK_SECRET"),
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

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

        // Find user by stripeCustomerId or fallback to client_reference_id
        let user = customerId
          ? await db.query.users.findFirst({
              where: eq(users.stripeCustomerId, customerId),
            })
          : null;

        if (!user && clientRefId) {
          user = await db.query.users.findFirst({
            where: eq(users.id, clientRefId),
          });
        }

        if (user) {
          await db
            .update(users)
            .set({
              planTier: "unlimited",
              stripeCustomerId: customerId ?? user.stripeCustomerId,
              stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId,
            })
            .where(eq(users.id, user.id));
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
          await db
            .update(users)
            .set({
              planTier: "unlimited",
              stripeSubscriptionId: subscription.id,
            })
            .where(eq(users.stripeCustomerId, customerId));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        await db
          .update(users)
          .set({
            planTier: "free",
            stripeSubscriptionId: null,
          })
          .where(eq(users.stripeCustomerId, customerId));
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (customerId) {
          await db
            .update(users)
            .set({ planTier: "free" })
            .where(eq(users.stripeCustomerId, customerId));
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
