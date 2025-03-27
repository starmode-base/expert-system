import { DocumentSelectWithTakeaways } from "~/server/queries";

export function DocumentContent({
  selectedDoc,
}: {
  selectedDoc: DocumentSelectWithTakeaways | null;
}) {
  return (
    <div className="flex h-full flex-col">
      {selectedDoc ? (
        <>
          {/* Top: Takeaways */}
          <div className="flex h-1/2 flex-col border-b border-gray-200 p-4">
            <h2 className="mb-2 text-2xl font-semibold">{selectedDoc.title}</h2>
            <div className="h-full flex-1 overflow-y-auto">
              {/* <div className="mb-4 flex flex-wrap">
                {selectedDoc.tags.map((tag) => (
                  <div
                    key={tag}
                    className="mr-1 rounded bg-gray-50 p-1 shadow-sm"
                  >
                    <p className="font-medium">{tag}</p>
                  </div>
                ))}
              </div> */}
              {selectedDoc.takeaways.map((takeaway) => (
                <div
                  key={takeaway.id}
                  className="mb-4 rounded bg-gray-50 p-4 shadow-sm"
                >
                  <p className="font-medium">
                    <span className="text-gray-600">Takeaway: </span>
                    {takeaway.takeaway}
                  </p>
                  <hr className="my-4 border-gray-300" />
                  <p className="font-medium">
                    <span className="text-gray-600">Concept: </span>
                    {takeaway.concept}
                  </p>
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
          </div>

          {/* Bottom: Article Text */}
          <div className="h-1/2 flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">{selectedDoc.title}</h2>
            </div>
            <div className="overflow-y-scroll">
              {/* pubDate */}
              <p className="mb-4 text-sm text-gray-600">
                {selectedDoc.pubDate}
              </p>
              <p className="whitespace-pre-wrap text-gray-800">
                {selectedDoc.articleText}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Select a document to view details</p>
        </div>
      )}
    </div>
  );
}
