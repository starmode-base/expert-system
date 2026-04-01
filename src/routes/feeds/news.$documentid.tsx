import { createFileRoute, invariant } from "@tanstack/react-router";
import { DocumentContent } from "~/components/document-content";
import { NewsFeedList } from "~/components/news-feed-list";
import { queryDocument, queryDocumentsPaginated } from "~/server/queries";

export const Route = createFileRoute("/feeds/news/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const page = await queryDocumentsPaginated({
      data: { cursor: null, limit: 25 },
    });
    const selectedDoc = await queryDocument({ data: documentid });

    return { page, selectedDoc };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { page, selectedDoc } = Route.useLoaderData();
  invariant(page, "No documents");
  invariant(selectedDoc, "No document selected");

  return (
    <div className="flex h-[calc(100dvh-109px)] overflow-hidden bg-gray-50">
      {/* Left Feed - hidden on mobile when document is selected */}
      <div className="hidden w-1/3 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            News Feed
          </h1>
        </div>

        <NewsFeedList initialPage={page} selectedDocId={selectedDoc.id} />
      </div>

      {/* Right Detail View */}
      <div className="flex h-full w-full flex-col bg-white md:w-2/3">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
