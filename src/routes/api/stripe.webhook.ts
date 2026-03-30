import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { db } from "~/postgres/db";
import { users } from "~/postgres/schema";
import { ensureEnv } from "~/lib/env";
import { handleStripeEvent, createDrizzleRepo } from "~/server/stripe-events";

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

    await handleStripeEvent(event, createDrizzleRepo(db, users));

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
