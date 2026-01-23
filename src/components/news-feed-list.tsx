import { Link } from "@tanstack/react-router";

interface DocumentItem {
  id: string;
  title: string;
  description: string;
  publicationDate: Date;
}

interface NewsFeedListProps {
  documents: DocumentItem[];
  selectedDocId?: string;
}

export function NewsFeedList(props: NewsFeedListProps) {
  const { documents, selectedDocId } = props;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {documents
        .slice()
        .sort(
          (a, b) => b.publicationDate.getTime() - a.publicationDate.getTime(),
        )
        .map((document) => {
          const isSelected = selectedDocId === document.id;
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
  );
}
