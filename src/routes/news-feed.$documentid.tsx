import { createFileRoute, invariant, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useState } from "react";
import { DocumentContent } from "~/components/document-content";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { sendEventScienceDailyScraperSF } from "~/server/inggest";
import { listOrganizationsSF } from "~/server/organizations";
import { queryDocument, queryDocuments } from "~/server/queries";

export const Route = createFileRoute("/news-feed/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const { viewerId } = await listOrganizationsSF();
    const documents = await queryDocuments();
    const selectedDoc = (await queryDocument({ data: documentid })) ?? null;

    return { viewerId, documents, selectedDoc };
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
  const { viewerId, documents, selectedDoc } = Route.useLoaderData();
  const [loading, setLoading] = useState(false);
  const sendEventScraper = useServerFn(sendEventScienceDailyScraperSF);

  // https://ably.com/docs/getting-started/react#useConnectionStateListener
  useConnectionStateListener("connected", (stateChange) => {
    console.log("Ably connection state:", stateChange.current);
  });

  useNotifyUI(viewerId, (message) => {
    console.log("message", message);
    setLoading(false);
  });

  invariant(documents, "No documents");

  return (
    <div className="flex h-screen" style={{ height: "calc(100vh - 48px)" }}>
      {/* Left Feed */}
      <div className="w-1/3 border-r border-gray-200 p-4">
        <div className="flex justify-between">
          <h1 className="text-2xl font-semibold">News Feed</h1>
          <button
            onClick={async () => {
              await sendEventScraper();
              setLoading(true);
            }}
            className="mb-2 cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-white"
          >
            Scrape News
          </button>
        </div>
        {loading ? (
          <div className="mb-4 flex">
            <p className="mr-2 text-gray-600">Loading News...</p>
          </div>
        ) : null}
        <div className="h-full flex-1 overflow-y-auto">
          {documents
            .slice()
            .sort(
              (a, b) =>
                new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
            )
            .map((document) => (
              <Link
                key={document.id}
                to="/news-feed/$documentid"
                params={{ documentid: document.id }}
              >
                <div
                  key={document.id}
                  className={`mb-4 cursor-pointer rounded p-4 transition-colors duration-200 ${
                    selectedDoc && selectedDoc.id === document.id
                      ? "bg-gray-200"
                      : "bg-white hover:bg-gray-100"
                  }`}
                >
                  <h2 className="text-xl font-bold">{document.title}</h2>
                  <p className="text-sm text-gray-600">{document.pubDate}</p>
                  <p className="mt-2 text-gray-800">{document.description}</p>
                </div>
              </Link>
            ))}
        </div>
      </div>

      {/* Right Detail View */}
      <div className="flex h-full w-2/3 flex-col">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
