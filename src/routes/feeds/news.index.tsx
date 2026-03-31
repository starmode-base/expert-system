import { createFileRoute } from "@tanstack/react-router";
import { NewsFeedList } from "~/components/news-feed-list";
import { queryDocumentsPaginated } from "~/server/queries";

export const Route = createFileRoute("/feeds/news/")({
  loader: async () => {
    const page = await queryDocumentsPaginated({
      data: { cursor: null, limit: 25 },
    });
    return { page };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { page } = Route.useLoaderData();

  return (
    <div className="flex h-[calc(100dvh-109px)] overflow-hidden bg-gray-50">
      {/* Feed List */}
      <div className="flex w-full flex-col border-r border-gray-200 bg-white md:w-1/3">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            News Feed
          </h1>
        </div>

        <NewsFeedList initialPage={page} />
      </div>

      {/* Empty State - desktop only */}
      <div className="hidden h-full w-2/3 flex-col bg-white md:flex">
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-500">
            Select a document to view details
          </p>
        </div>
      </div>
    </div>
  );
}
