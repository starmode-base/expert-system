import { SignInButton, SignUpButton } from "@clerk/tanstack-start";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { InsightCard } from "~/components/insight-card";
import {
  queryPublicInsightsFeed,
  type InsightsFeedItem,
} from "~/server/queries";

export function SignedOutExperience() {
  const loadPublicFeed = useServerFn(queryPublicInsightsFeed);
  const [items, setItems] = useState<InsightsFeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const nextItems = (await loadPublicFeed()) as InsightsFeedItem[];
        if (cancelled) return;
        setItems(nextItems);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load insights");
        setItems([]);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadPublicFeed]);

  return (
    <div className="flex h-dvh flex-col bg-slate-100 p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 pb-6">
          <img src="/starmode-logo.svg" alt="STΛR MODΞ logo" className="h-10" />
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <button className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-md border border-zinc-900 bg-white px-4 py-2 text-zinc-900">
                Sign up
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4 text-2xl font-semibold text-slate-800">
          Feed
        </div>

        {error ? (
          <div className="pt-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-4 flex-1 overflow-y-auto">
          {items === null ? (
            <div className="py-10 text-sm text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-sm text-gray-500">No insights yet.</div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <InsightCard
                  key={item.insight.id}
                  insight={item.insight}
                  insightReferences={item.insightReferences}
                  loading={false}
                  className="bg-white"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
