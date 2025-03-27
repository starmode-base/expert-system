import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useState } from "react";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import {
  sendEventEarningsCallscraperSF,
  sendEventScienceDailyScraperSF,
} from "~/server/inggest";
import { listOrganizationsSF } from "~/server/organizations";

export const Route = createFileRoute("/scrape-dash")({
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();

    return { viewerId };
  },
  component: RouteComponentProvider,
});

/**
 * Route component
 */
function RouteComponentProvider() {
  const { viewerId } = Route.useLoaderData();

  return (
    <PubSubProvider viewerId={viewerId}>
      <RouteComponent />
    </PubSubProvider>
  );
}

function RouteComponent() {
  const { viewerId } = Route.useLoaderData();

  // https://ably.com/docs/getting-started/react#useConnectionStateListener
  useConnectionStateListener("connected", (stateChange) => {
    console.log("Ably connection state:", stateChange.current);
  });

  useNotifyUI(viewerId, (message) => {
    console.log("message", message);
    setLoading(false);
  });

  const [loading, setLoading] = useState(false);

  const sendEventScienceDailyScraper = useServerFn(
    sendEventScienceDailyScraperSF,
  );

  const sendEventEarningsCallscraper = useServerFn(
    sendEventEarningsCallscraperSF,
  );

  return (
    <div className="flex h-screen" style={{ height: "calc(100vh - 48px)" }}>
      <div className="flex w-full flex-col px-4 py-2">
        <h1 className="text-2xl font-semibold">News Feed</h1>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await sendEventScienceDailyScraper();
                setLoading(true);
              }}
              className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
            >
              Scrape News
            </button>

            <button
              onClick={async () => {
                await sendEventEarningsCallscraper();
                setLoading(true);
              }}
              className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1 text-white"
            >
              Scrape Earnings Call
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center">
            <p className="text-gray-600">Loading News...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
