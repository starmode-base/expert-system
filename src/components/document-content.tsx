import { useState } from "react";
import { Document } from "~/server/queries";
import { TakeawayTile } from "./takeaway-tile";

export function TakeawaysSection(props: { selectedDoc: Document }) {
  const selectedDoc = props.selectedDoc;

  if (selectedDoc.takeaways.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-gray-500">No takeaways for this document</p>
      </div>
    );
  }

  return (
    <div>
      {selectedDoc.takeaways.map((takeaway) => {
        return <TakeawayTile key={takeaway.id} takeaway={takeaway} />;
      })}
    </div>
  );
}

export function ArticleSection(props: { selectedDoc: Document }) {
  const selectedDoc = props.selectedDoc;

  return (
    <div className="h-full flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {selectedDoc.title}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {selectedDoc.publicationDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
          {selectedDoc.articleText}
        </p>
      </div>
    </div>
  );
}

type TabType = "takeaways" | "article";

export function DocumentContent(props: { selectedDoc: Document | null }) {
  const selectedDoc = props.selectedDoc;
  const [activeTab, setActiveTab] = useState<TabType>("takeaways");

  if (!selectedDoc) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">
          Select a document to view details
        </p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "takeaways":
        return <TakeawaysSection selectedDoc={selectedDoc} />;
      case "article":
        return <ArticleSection selectedDoc={selectedDoc} />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          {selectedDoc.title}
        </h2>
        {selectedDoc.source ? (
          <p className="mt-1 text-sm text-gray-500">
            {selectedDoc.link ? (
              <a
                href={selectedDoc.link}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {selectedDoc.source}
              </a>
            ) : (
              selectedDoc.source
            )}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-gray-500">
          {selectedDoc.publicationDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tab Headers */}
      <div className="border-b border-gray-200 px-4 sm:px-6">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => {
              setActiveTab("takeaways");
            }}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "takeaways"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Takeaways
          </button>
          <button
            onClick={() => {
              setActiveTab("article");
            }}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "article"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            Article
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">{renderTabContent()}</div>
    </div>
  );
}
