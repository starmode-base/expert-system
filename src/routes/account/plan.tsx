import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SignInButton } from "@clerk/tanstack-start";
import { createPortalSessionSF } from "~/server/stripe";

const loadPlan = createServerFn({ method: "GET" }).handler(async () => {
  const { getWebRequest } = await import("vinxi/http");
  const { getClerkUserId } = await import("~/server/auth");
  const { db } = await import("~/postgres/db");
  const { users } = await import("~/postgres/schema");
  const { eq } = await import("drizzle-orm");

  const userId = await getClerkUserId(getWebRequest());
  if (!userId) {
    return { authenticated: false as const, plan: null };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, userId),
    columns: {
      planTier: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  return {
    authenticated: true as const,
    plan: user
      ? {
          tier: user.planTier,
          hasSubscription: !!user.stripeSubscriptionId,
          hasStripeAccount: !!user.stripeCustomerId,
        }
      : null,
  };
});

export const Route = createFileRoute("/account/plan")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  loader: () => loadPlan(),
  component: PlanPage,
});

function PlanPage() {
  const { authenticated, plan } = Route.useLoaderData();
  const [loading, setLoading] = useState(false);
  const search = Route.useSearch();
  const checkoutSuccess = search.checkout === "success";
  const createPortalSession = useServerFn(createPortalSessionSF);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-8 text-2xl font-semibold text-gray-900">Plan</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="mb-4 text-sm text-gray-600">
            Sign in to view your plan.
          </p>
          <SignInButton mode="modal">
            <button className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const tier = plan?.tier ?? "free";
  const isUnlimited = tier === "unlimited";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Plan</h1>

      {checkoutSuccess ? (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800">
            You're on the Unlimited plan. Welcome aboard!
          </p>
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {isUnlimited ? "Unlimited" : "Free"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isUnlimited
                ? "Unlimited API queries"
                : "100 API queries per month"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isUnlimited
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isUnlimited ? "Active" : "Free tier"}
          </span>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6">
          {isUnlimited && plan?.hasSubscription ? (
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="cursor-pointer rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Redirecting..." : "Manage subscription"}
            </button>
          ) : (
            <Link
              to="/pricing"
              className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Upgrade to Unlimited
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
