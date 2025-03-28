import {
  createFileRoute,
  invariant,
  useNavigate,
} from "@tanstack/react-router";
import ForceGraph2D, {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import { queryDocument } from "~/server/queries";
import { DocumentContent } from "~/components/document-content";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadGraphData } from "~/server/build-graph";
import { FilterBar, FilterParams } from "~/components/filter-bar";

export const Route = createFileRoute("/knowledge-graph/$graphType/$documentid")(
  {
    loader: async ({ params: { graphType, documentid } }) => {
      const graphData = await loadGraphData({ data: graphType });
      const selectedDoc = (await queryDocument({ data: documentid })) ?? null;

      return { graphType, graphData, selectedDoc };
    },
    component: RouteComponent,
  },
);

interface GraphData {
  nodes: { id: string; label: string; category: string }[];
  links: {
    source: string;
    target: string;
    similarity: number;
  }[];
}

function KnowledgeGraph({
  graphType,
  graphData,
}: {
  graphType: string;
  graphData: GraphData;
}) {
  const [similarityMultiplier, setSimilarityMultiplier] = useState(0.3); // slider state
  const [filters, setFilters] = useState<FilterParams>({
    sources: [],
    categories: [],
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    console.log("filters", filters);
  }, [filters]);

  // Memoize filtered links to recompute only when necessary.
  const filteredLinks = useMemo(
    () =>
      graphData.links.filter((link) => link.similarity >= similarityMultiplier),
    [graphData.links, similarityMultiplier],
  );

  // Also memoize the overall graph data object.
  const graph = useMemo(
    () => ({
      nodes: graphData.nodes,
      links: filteredLinks,
    }),
    [graphData.nodes, filteredLinks],
  );

  const fgRef =
    useRef<
      ForceGraphMethods<
        NodeObject<{ id: string; label: string }>,
        LinkObject<
          { id: string; label: string },
          { source: string; target: string; similarity: number }
        >
      >
    >(undefined);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(1000, 150);
      }
    }, 5); // 100ms delay
    return () => {
      clearTimeout(timeout);
    };
  }, [graphData]);

  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col">
      {/* Slider */}

      <FilterBar
        availableSources={["Source A", "Source B", "Source C"]}
        availableCategories={["Category X", "Category Y", "Category Z"]}
        filters={filters}
        setFilters={setFilters}
      />

      <div className="flex items-center gap-2 bg-gray-50 px-4 py-2">
        <label className="text-sm font-medium">Similarity Threshold:</label>
        <input
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={similarityMultiplier}
          onChange={(e) => {
            setSimilarityMultiplier(parseFloat(e.target.value));
          }}
          className="w-64"
        />
        <span className="w-12 text-right text-sm">
          {similarityMultiplier.toFixed(2)}
        </span>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <ForceGraph2D
          d3VelocityDecay={0.5}
          ref={fgRef}
          graphData={graph}
          width={window.innerWidth * 0.5}
          height={window.innerHeight - 150}
          nodeLabel="label"
          linkLabel={"similarity"}
          nodeAutoColorBy="category"
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={(d) => d.similarity * 0.01}
          linkDirectionalParticleWidth={(d) => d.similarity * 2}
          linkWidth={(d) => d.similarity * 1.75}
          onNodeClick={async (node) => {
            console.log("Clicked node:", node);
            await navigate({
              to: `/knowledge-graph/$graphType/$documentid`,
              params: { graphType, documentid: node.id },
            });
          }}
        />
      </div>
    </div>
  );
}

function RouteComponent() {
  const { graphType, graphData, selectedDoc } = Route.useLoaderData();

  // TODO: Mikael how do i clean this up?
  const navigate = useNavigate();
  if ((graphType !== "topic" && graphType !== "concept") || !graphData) {
    return navigate({
      to: "/knowledge-graph/$graphType/$documentid",
      params: { graphType: "topic", documentid: selectedDoc?.id ?? "" },
    });
  }
  invariant(graphData, "No graph data");
  return (
    <div className="flex h-screen" style={{ height: "calc(100vh - 48px)" }}>
      <div className="w-1/2 overflow-y-hidden border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-semibold">Knowledge Graph</h1>
        <div className="mb-4 flex">
          <button
            onClick={async () => {
              await navigate({
                to: "/knowledge-graph/$graphType/$documentid",
                params: {
                  graphType: "topic",
                  documentid: selectedDoc?.id ?? "",
                },
              });
            }}
            className="mr-2 cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-white"
          >
            Topics
          </button>
          <button
            onClick={async () => {
              await navigate({
                to: "/knowledge-graph/$graphType/$documentid",
                params: {
                  graphType: "concept",
                  documentid: selectedDoc?.id ?? "",
                },
              });
            }}
            className="cursor-pointer rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-white"
          >
            Concepts
          </button>
        </div>

        <KnowledgeGraph graphType={graphType} graphData={graphData} />
      </div>
      <div className="w-1/2 border-r border-gray-200">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
