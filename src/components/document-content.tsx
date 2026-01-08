import { useState } from "react";
import { Document } from "~/server/queries";
import { TakeawayTile } from "./takeaway-tile";

export function TakeawaysSection(props: { selectedDoc: Document }) {
  const selectedDoc = props.selectedDoc;

  return (
    <div className="border-t border-gray-200">
      {selectedDoc.takeaways.map((takeaway) => {
        return (
          <div key={takeaway.id} className="border-b border-gray-200">
            <TakeawayTile takeaway={takeaway} />
          </div>
        );
      })}
    </div>
  );
}

export function ArticleSection(props: { selectedDoc: Document }) {
  const selectedDoc = props.selectedDoc;

  return (
    <div className="h-full flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{selectedDoc.title}</h2>
      </div>
      <div className="overflow-y-scroll">
        <p className="mb-4 text-sm text-gray-600">
          {selectedDoc.publicationDate.toLocaleString()}
        </p>
        <p className="whitespace-pre-wrap text-gray-800">
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
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Select a document to view details</p>
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
      <h2 className="mb-4 px-4 pt-4 text-2xl font-semibold">
        {selectedDoc.title}
      </h2>

      {/* Tab Headers */}
      <div className="mb-2 border-b border-gray-200 px-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => {
              setActiveTab("takeaways");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "takeaways"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Takeaways
          </button>
          <button
            onClick={() => {
              setActiveTab("article");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "article"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Article
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {renderTabContent()}
      </div>
    </div>
  );
}
