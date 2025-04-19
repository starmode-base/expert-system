import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef, useCallback } from "react";
import { DocumentContent } from "~/components/document-content";
import { TakeawayTile } from "~/components/takeaway-tile";
import { getInsightsSF } from "~/server/insights-studio-SFs";
import { queryDocumentByTakeaway, queryTakeaways } from "~/server/queries";
import { searchTakeawaysSF, TakeawaySearchResult } from "~/server/searchSFs";

export function useSpeechSynthesis() {
  const speak = useCallback((text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!window.speechSynthesis) {
      console.error("SpeechSynthesis not supported in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.cancel(); // stop any current speech
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  return { speak, stop };
}

export const Route = createFileRoute("/search/$takeawayid")({
  loader: async ({ params: { takeawayid } }) => {
    const insights = await getInsightsSF();
    const takeaways = await queryTakeaways();
    if (!takeawayid || takeawayid === "none") {
      takeawayid = takeaways[0]?.id ?? "";
    }
    const selectedDoc = await queryDocumentByTakeaway({ data: takeawayid });

    return { insights, takeaways, selectedDoc, takeawayid };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { takeaways, insights, selectedDoc, takeawayid } =
    Route.useLoaderData();
  const router = useRouter();
  const [takeawaySearchResults, setTakeawaySearchResults] =
    useState<TakeawaySearchResult[]>(takeaways);
  const [searchInput, setSearchInput] = useState("");
  const [selectedTakeaway, setSelectedTakeaway] = useState<string | null>(
    takeawayid,
  );
  // Toggle to enable/disable automatic text‑to‑speech
  const [ttsEnabled, setTTSEnabled] = useState(false);
  // Ref to the scrollable results pane
  const listRef = useRef<HTMLDivElement | null>(null);

  // Ensure only the results pane scrolls, not the whole page
  useEffect(() => {
    if (!selectedTakeaway || !listRef.current) return;
    const parent = listRef.current;
    const el = document.getElementById(`takeaway-${selectedTakeaway}`);
    if (el) {
      parent.scrollTo({
        top: el.offsetTop - parent.clientHeight / 4,
        behavior: "smooth",
      });
    }
  }, [selectedTakeaway, takeawaySearchResults.length]);
  const searchTakeaways = useServerFn(searchTakeawaysSF);

  const handleSearch = async () => {
    console.log(searchInput);
    if (!searchInput.trim()) return;
    const results = await searchTakeaways({ data: searchInput });
    setTakeawaySearchResults(results);
    console.log(results);
  };

  // TEMPORARY - TODO: Remove when tts.ts is complete
  const { speak, stop } = useSpeechSynthesis();
  // Handle text-to-speech
  const handlePlayTTS = useCallback(
    (ttsInput: string) => {
      // TODO: Respace with tts.ts
      if (ttsEnabled) {
        stop();
        speak(ttsInput);
      }
    },
    [ttsEnabled, speak, stop],
  );

  // Handle up/down keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
      const index = takeawaySearchResults.findIndex(
        (t) => t.id === selectedTakeaway,
      );
      if (index === -1) return;

      let newIndex = index;
      if (e.key === "ArrowUp") {
        newIndex = Math.max(0, index - 1);
      } else if (e.key === "ArrowDown") {
        newIndex = Math.min(takeawaySearchResults.length - 1, index + 1);
      }

      const newTakeaway = takeawaySearchResults[newIndex];
      if (newTakeaway && newTakeaway.id !== selectedTakeaway) {
        setSelectedTakeaway(newTakeaway.id);
        void router.navigate({
          to: "/search/$takeawayid",
          params: { takeawayid: newTakeaway.id },
        });

        handlePlayTTS(newTakeaway.concept);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTakeaway, takeawaySearchResults, handlePlayTTS, router]);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-1/2 border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-bold">Search Takeaways</h1>
        <div className="flex gap-2 border-b border-gray-200 pb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await handleSearch();
              }
            }}
            placeholder="Search takeaways..."
            className="flex-grow rounded border border-gray-300 p-2"
          />
          <button
            onClick={handleSearch}
            className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-4 py-1 text-white"
          >
            Search
          </button>
        </div>
        {/* AUTO‑TTS TOGGLE */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="toggle-tts"
            checked={ttsEnabled}
            onChange={(e) => {
              setTTSEnabled(e.target.checked);
            }}
            className="h-4 w-4 cursor-pointer"
          />
          <label
            htmlFor="toggle-tts"
            className="cursor-pointer text-sm text-gray-700"
          >
            Auto‑read takeaway
          </label>
        </div>

        {/* SEARCH PANE */}
        <div ref={listRef} className="h-full flex-1 overflow-y-auto">
          {" "}
          {takeawaySearchResults.length === 0 ? (
            <p className="text-gray-500">No takeaways found.</p>
          ) : (
            <div className="space-y-4">
              {takeawaySearchResults.map((takeaway) => (
                <Link
                  key={takeaway.id}
                  id={`takeaway-${takeaway.id}`}
                  to="/search/$takeawayid"
                  params={{ takeawayid: takeaway.id }}
                  onClick={() => {
                    setSelectedTakeaway(takeaway.id);
                    handlePlayTTS(takeaway.takeaway);
                  }}
                >
                  <TakeawayTile
                    key={takeaway.id}
                    takeaway={takeaway}
                    insights={insights}
                    highlighted={takeaway.id === selectedTakeaway}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex h-full w-2/3 flex-col">
        <DocumentContent selectedDoc={selectedDoc} insights={insights} />
      </div>
    </div>
  );
}
