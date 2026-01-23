import { createFileRoute, invariant, Link } from "@tanstack/react-router";
import { DocumentContent } from "~/components/document-content";
import { listOrganizationsSF } from "~/server/organizations";
import { queryDocument, queryDocuments } from "~/server/queries";

export const Route = createFileRoute("/news-feed/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const { viewerId } = await listOrganizationsSF();
    console.log({ viewerId });
    const documents = await queryDocuments();

    const selectedDoc = await queryDocument({ data: documentid });

    return { documents, selectedDoc };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { documents, selectedDoc } = Route.useLoaderData();
  invariant(documents, "No documents");

  return (
    <div className="flex h-[calc(100dvh-64px)] overflow-hidden bg-gray-50">
      {/* Left Feed */}
      <div className="flex w-1/3 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <h1 className="font-semibold text-gray-900 sm:text-2xl">News Feed</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {documents
            .slice()
            .sort(
              (a, b) =>
                b.publicationDate.getTime() - a.publicationDate.getTime(),
            )
            .map((document) => {
              const isSelected = selectedDoc && selectedDoc.id === document.id;
              const description = document.description.trim();
              return (
                <Link
                  key={document.id}
                  to="/news-feed/$documentid"
                  params={{ documentid: document.id }}
                >
                  <div
                    className={`cursor-pointer border-b border-gray-200 p-4 transition-colors sm:p-6 ${
                      isSelected
                        ? "border-l-2 border-l-gray-900 bg-gray-50"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <h2 className="text-base leading-tight font-semibold text-gray-900 sm:text-lg">
                      {document.title}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {document.publicationDate.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {description.length > 0 ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-700">
                        {description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
        </div>
      </div>

      {/* Right Detail View */}
      <div className="flex h-full w-2/3 flex-col bg-white">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
