import { createFileRoute, invariant, Link } from "@tanstack/react-router";
import { DocumentContent } from "~/components/document-content";
import { queryDocument, queryDocuments } from "~/server/queries";

//  TODO: parameterize route
// export const Route = createFileRoute("/news-feed/$documentid")({
//     loader: async ({ params: { id: documentId } }) => {

export const Route = createFileRoute("/news-feed/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const documents = await queryDocuments();
    const selectedDoc = (await queryDocument({ data: documentid })) ?? null;

    return { documents, selectedDoc };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { documents, selectedDoc } = Route.useLoaderData();
  invariant(documents, "No documents");

  return (
    <div className="flex h-screen" style={{ height: "calc(100vh - 48px)" }}>
      {/* Left Feed */}
      <div className="w-1/3 overflow-y-auto border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-semibold">News Feed</h1>
        {documents.map((document) => (
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

      {/* Right Detail View */}
      <div className="flex h-full w-2/3 flex-col">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
