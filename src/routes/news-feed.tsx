import { createFileRoute, invariant } from "@tanstack/react-router";
import { useState } from "react";
import { queryDocuments } from "~/server/queries";

//  TODO: parameterize route
// export const Route = createFileRoute("/news-feed")({
//     loader: async ({ params: { id: documentId } }) => {

export const Route = createFileRoute("/news-feed")({
  loader: async () => {
    const documents = await queryDocuments();

    return { documents };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { documents } = Route.useLoaderData();
  invariant(documents, "No documents");

  // Use state to track the selected document.
  const [selectedDoc, setSelectedDoc] = useState(documents[0] ?? null);

  return (
    <div className="flex h-screen">
      {/* Left Feed */}
      <div className="w-1/3 overflow-y-auto border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-semibold">News Feed</h1>
        {documents.map((document) => (
          <div
            key={document.id}
            onClick={() => {
              setSelectedDoc(document);
            }}
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
        ))}
      </div>

      {/* Right Detail View */}
      <div className="flex w-2/3 flex-col">
        {selectedDoc ? (
          <>
            {/* Top: Takeaways */}
            <div className="h-1/3 flex-1 overflow-y-auto border-b border-gray-200 p-4">
              <h2 className="mb-4 text-2xl font-semibold">Takeaways</h2>

              {selectedDoc.takeaways.map((takeaway) => (
                <div
                  key={takeaway.id}
                  className="mb-4 rounded bg-gray-50 p-4 shadow-sm"
                >
                  <p className="font-medium">{takeaway.takeaway}</p>
                  <hr className="my-4 border-gray-300" />
                  <p className="font-medium">{takeaway.concept}</p>

                  <div className="mt-2 flex space-x-4">
                    <p className="text-sm text-gray-600">
                      Monetization: {takeaway.monetization}
                    </p>
                    <p className="text-sm text-gray-600">
                      Importance: {takeaway.importance}
                    </p>
                    <p className="text-sm text-gray-600">
                      Novelty: {takeaway.novelty}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom: Article Text */}
            <div className="h-2/3 flex-1 overflow-y-auto p-4">
              <h2 className="mb-4 text-2xl font-semibold">
                {selectedDoc.title}
              </h2>
              <p className="whitespace-pre-wrap text-gray-800">
                {selectedDoc.articleText}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-500">Select a document to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
