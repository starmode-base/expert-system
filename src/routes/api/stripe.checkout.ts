import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "~/postgres/db";
import { users } from "~/postgres/schema";
import { ensureEnv, getSiteOrigin } from "~/lib/env";
import { getViewerId } from "~/server/auth";

const apiError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const APIRoute = createAPIFileRoute("/api/stripe/checkout")({
  POST: async ({ request }) => {
    let userId: string | null;
    try {
      userId = await getViewerId(request);
    } catch (e) {
      console.error("Stripe checkout auth error:", e);
      return apiError("Authentication failed", 401);
    }
    if (!userId) return apiError("Unauthorized", 401);

    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("interval" in body) ||
      (body.interval !== "month" && body.interval !== "year")
    ) {
      return apiError(
        'Invalid body: expected { interval: "month" | "year" }',
        400,
      );
    }
    const interval = body.interval;

    const stripe = new Stripe(ensureEnv("STRIPE_SECRET_KEY"));

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) return apiError("User not found", 404);

    // Create or reuse Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, userId));
    }

    const priceId =
      interval === "month"
        ? ensureEnv("STRIPE_MONTHLY_PRICE_ID")
        : ensureEnv("STRIPE_ANNUAL_PRICE_ID");

    const siteOrigin = getSiteOrigin();

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      client_reference_id: userId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteOrigin}/account/api-keys?checkout=success`,
      cancel_url: `${siteOrigin}/#pricing`,
    });

    if (!session.url) return apiError("Failed to create checkout session", 500);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
