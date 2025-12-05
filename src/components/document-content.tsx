import { useState } from "react";
import { InsightSelect } from "~/postgres/schema";
import { Document } from "~/server/queries";
import { TakeawaySearchResult } from "~/server/searchSFs";
import { TakeawayTile } from "./takeaway-tile";

export function TakeawaysSection({
  selectedDoc,
  insights,
}: {
  selectedDoc: Document;
  insights: InsightSelect[];
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {selectedDoc.takeaways.map((takeaway) => (
        <TakeawayTile
          key={takeaway.id}
          takeaway={takeaway}
          insights={insights}
        />
      ))}
    </div>
  );
}

export function ArticleSection({ selectedDoc }: { selectedDoc: Document }) {
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

export function SimilarTakeawaysSection(props: {
  similarTakeaways: TakeawaySearchResult[];
  insights: InsightSelect[];
}) {
  if (props.similarTakeaways.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-gray-500">No similar takeaways found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {props.similarTakeaways.map((takeaway) => (
        <TakeawayTile
          key={takeaway.id}
          takeaway={takeaway}
          insights={props.insights}
        />
      ))}
    </div>
  );
}

export function SimilarConceptsSection(props: {
  similarConcepts: TakeawaySearchResult[];
  insights: InsightSelect[];
}) {
  if (props.similarConcepts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-gray-500">No similar concepts found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {props.similarConcepts.map((takeaway) => (
        <TakeawayTile
          key={takeaway.id}
          takeaway={takeaway}
          insights={props.insights}
        />
      ))}
    </div>
  );
}

type TabType = "takeaways" | "article" | "similarTakeaways" | "similarConcepts";

export function DocumentContent({
  selectedDoc,
  insights,
}: {
  selectedDoc: Document | null;
  insights: InsightSelect[];
}) {
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
        return (
          <TakeawaysSection selectedDoc={selectedDoc} insights={insights} />
        );
      case "article":
        return <ArticleSection selectedDoc={selectedDoc} />;
      case "similarTakeaways":
        return (
          <SimilarTakeawaysSection
            similarTakeaways={selectedDoc.similarTakeaways ?? []}
            insights={insights}
          />
        );
      case "similarConcepts":
        return (
          <SimilarConceptsSection
            similarConcepts={selectedDoc.similarConcepts ?? []}
            insights={insights}
          />
        );
    }
  };

  return (
    <div className="flex h-full flex-col">
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
          <button
            onClick={() => {
              setActiveTab("similarTakeaways");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "similarTakeaways"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Similar Takeaways
          </button>
          <button
            onClick={() => {
              setActiveTab("similarConcepts");
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === "similarConcepts"
                ? "border-black-500 text-black-600"
                : "hover:text-black-600 border-transparent text-gray-500"
            }`}
          >
            Similar Concepts
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
