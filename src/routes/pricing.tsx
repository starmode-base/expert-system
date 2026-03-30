import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SignInButton, useAuth } from "@clerk/tanstack-start";
import { createCheckoutSessionSF } from "~/server/stripe";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loading, setLoading] = useState(false);
  const createCheckoutSession = useServerFn(createCheckoutSessionSF);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckoutSession({ data: { interval } });
      window.location.href = url;
    } catch (err) {
      if (err instanceof Error && err.message.includes("Already subscribed")) {
        void navigate({ to: "/account/plan" });
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-3xl font-semibold text-gray-900">Pricing</h1>
        <p className="text-sm text-gray-500">
          Start free, upgrade when you need more.
        </p>
      </div>

      {/* Interval toggle */}
      <div className="mx-auto mb-8 flex w-fit items-center justify-center gap-1 rounded-full border border-slate-200 bg-white p-1">
        <button
          onClick={() => {
            setInterval("month");
          }}
          className={`cursor-pointer rounded-full px-5 py-2 text-base font-medium transition-colors ${
            interval === "month"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => {
            setInterval("year");
          }}
          className={`cursor-pointer rounded-full px-5 py-2 text-base font-medium transition-colors ${
            interval === "year"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Annual
          <span className="ml-1.5 text-sm font-normal text-emerald-600">
            Save 37%
          </span>
        </button>
      </div>

      {/* Plans */}
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Free tier */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Free</h2>
          <p className="mb-4 text-sm text-gray-500">For exploring the API</p>
          <p className="mb-6">
            <span className="text-3xl font-semibold text-gray-900">$0</span>
            <span className="text-sm text-gray-500">/month</span>
          </p>
          <ul className="mb-6 space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-400">-</span>
              100 API queries per month
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-400">-</span>
              All endpoints included
            </li>
          </ul>
          {auth.isSignedIn ? (
            <button
              onClick={() => {
                void navigate({ to: "/account/api-keys" });
              }}
              className="w-full cursor-pointer rounded-md border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Get started
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="w-full cursor-pointer rounded-md border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                Sign up free
              </button>
            </SignInButton>
          )}
        </div>

        {/* Unlimited tier */}
        <div className="rounded-lg border-2 border-slate-900 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            Unlimited
          </h2>
          <p className="mb-4 text-sm text-gray-500">For production use</p>
          <p className="mb-6">
            <span className="text-3xl font-semibold text-gray-900">
              {interval === "month" ? "$4" : "$2.50"}
            </span>
            <span className="text-sm text-gray-500">/month</span>
            {interval === "year" ? (
              <span className="ml-2 text-xs text-gray-400">
                billed $30/year
              </span>
            ) : null}
          </p>
          <ul className="mb-6 space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-400">-</span>
              Unlimited API queries
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-400">-</span>
              All endpoints included
            </li>
          </ul>
          {auth.isSignedIn ? (
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Redirecting..." : "Upgrade"}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="w-full cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-slate-800">
                Sign up to upgrade
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </div>
  );
}
