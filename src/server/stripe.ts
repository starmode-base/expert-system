import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { ensureEnv, getSiteOrigin } from "~/lib/env";
import { authMiddleware } from "~/middleware/auth-middleware";

export const createCheckoutSessionSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ interval: z.enum(["month", "year"]) }))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const stripe = new Stripe(ensureEnv("STRIPE_SECRET_KEY"));

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, context.viewer.id),
      columns: {
        email: true,
        stripeCustomerId: true,
        planTier: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) throw new Error("User not found");

    if (user.planTier === "unlimited" && user.stripeSubscriptionId) {
      throw new Error("Already subscribed");
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: context.viewer.id },
      });
      stripeCustomerId = customer.id;
      await db
        .update(schema.users)
        .set({ stripeCustomerId })
        .where(eq(schema.users.id, context.viewer.id));
    }

    const priceId =
      data.interval === "month"
        ? ensureEnv("STRIPE_MONTHLY_PRICE_ID")
        : ensureEnv("STRIPE_ANNUAL_PRICE_ID");

    const siteOrigin = getSiteOrigin();

    // TODO: remove after verifying the fix
    console.log("[stripe] VERCEL_URL:", process.env.VERCEL_URL);
    console.log("[stripe] VITE_VERCEL_URL:", process.env.VITE_VERCEL_URL);
    console.log(
      "[stripe] VERCEL_PROJECT_PRODUCTION_URL:",
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    );
    console.log(
      "[stripe] VITE_VERCEL_PROJECT_PRODUCTION_URL:",
      process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL,
    );
    console.log("[stripe] SITE_ORIGIN:", process.env.SITE_ORIGIN);
    console.log("[stripe] getSiteOrigin():", siteOrigin);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      client_reference_id: context.viewer.id,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteOrigin}/account/plan?checkout=success`,
      cancel_url: `${siteOrigin}/pricing`,
    });

    if (!session.url) throw new Error("Failed to create checkout session");

    return { url: session.url };
  });

export const createPortalSessionSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, context.viewer.id),
      columns: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error("No billing account found");
    }

    const stripe = new Stripe(ensureEnv("STRIPE_SECRET_KEY"));

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getSiteOrigin()}/account/plan`,
    });

    return { url: session.url };
  });
