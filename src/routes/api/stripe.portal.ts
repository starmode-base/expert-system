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

export const APIRoute = createAPIFileRoute("/api/stripe/portal")({
  POST: async ({ request }) => {
    const userId = await getViewerId(request);
    if (!userId) return apiError("Unauthorized", 401);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return apiError("No billing account found", 400);
    }

    const stripe = new Stripe(ensureEnv("STRIPE_SECRET_KEY"));

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getSiteOrigin()}/account/api-keys`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
