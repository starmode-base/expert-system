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
import { getFilterValues, queryDocument } from "~/server/queries";
import { DocumentContent } from "~/components/document-content";
import { useEffect, useRef, useState } from "react";
import { Edge, GraphData, loadGraphData, Node } from "~/server/build-graph";
import { FilterBar, FilterParams } from "~/components/filter-bar";

export const Route = createFileRoute("/knowledge-graph/$graphType/$documentid")(
  {
    loader: async ({ params: { graphType, documentid } }) => {
      const graphData = await loadGraphData({ data: graphType });
      const selectedDoc = (await queryDocument({ data: documentid })) ?? null;
      const { sources, categories } = await getFilterValues();

      return {
        graphType,
        graphData,
        selectedDoc,
        sources,
        categories,
      };
    },
    component: RouteComponent,
  },
);

function KnowledgeGraph({
  graphType,
  graphData,
  sources,
}: {
  graphType: string;
  graphData: GraphData;
  sources: string[];
  categories: string[];
}) {
  const fgRef =
    useRef<ForceGraphMethods<NodeObject<Node>, LinkObject<Edge>>>(undefined);

  const [similarityThreshold, setSimilarityThreshold] = useState(0.4); // slider state
  const [filters, setFilters] = useState<FilterParams>({
    sources,
    startDate: undefined,
    endDate: undefined,
  });
  const [filteredLinks, setFilteredLinks] = useState(graphData.links);
  const [filteredNodes, setFilteredNodes] = useState<Node[]>(graphData.nodes);
  const [filteredGraphData, setFilteredGraphData] = useState(graphData);

  useEffect(() => {
    const filteredNodeTemp = graphData.nodes.filter(
      (node) =>
        filters.sources.includes(node.source) &&
        (!filters.startDate ||
          node.publicationDate >= new Date(filters.startDate)) &&
        (!filters.endDate || node.publicationDate <= new Date(filters.endDate)),
    );
    setFilteredNodes(filteredNodeTemp);
  }, [graphData.nodes, filters.sources, filters.startDate, filters.endDate]);

  // Define a type guard for objects with an id property
  // Initially, when the component mounts, the types or values might align just fine (or the links might be structured differently). But when you update similarityThreshold, the effect runs again and the check fails because of a type mismatch between link.target (as an object) and the expected id (a primitive).
  // https://chatgpt.com/share/67e80e7f-5980-8010-a4df-f8350304caa3
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isObject(target: any): target is { id: string | number } {
    const isObjectWithId = (target &&
      typeof target === "object" &&
      "id" in target) as boolean;
    return isObjectWithId;
  }

  // Filtering logic for links
  useEffect(() => {
    const filteredNodesIds = filteredNodes.map((node) => node.id);

    const filteredLinkTemp = graphData.links.filter((link) => {
      const targetId = isObject(link.target)
        ? (link.target.id as string)
        : link.target;
      const sourceId = isObject(link.source)
        ? (link.source.id as string)
        : link.source;

      return (
        link.similarity >= similarityThreshold &&
        filteredNodesIds.includes(targetId) &&
        filteredNodesIds.includes(sourceId)
      );
    });
    setFilteredLinks(filteredLinkTemp);
  }, [graphData.links, filteredNodes, similarityThreshold]);

  useEffect(() => {
    setFilteredGraphData({ nodes: filteredNodes, links: filteredLinks });
  }, [filteredNodes, filteredLinks]);

  //  For debugging
  // useEffect(() => {
  //   console.log("filters", filters);
  //   console.log("Links", filteredLinks);
  //   console.log("Nodes", filteredNodes);
  // }, [filteredLinks, filteredNodes, filters, graphData.links, graphData.nodes]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(1000, 150);
      }
      // If there is a bug wil rerendering the graph, increase the timeout
    }, 100); // 100ms delay
    return () => {
      clearTimeout(timeout);
    };
  }, [graphData]);

  const navigate = useNavigate();

  const linkToDocument = async (nodeId: string) => {
    const takeaway = graphData.nodes.find((node) => node.id === nodeId);

    await navigate({
      to: "/knowledge-graph/$graphType/$documentid",
      params: { graphType, documentid: takeaway?.documentId ?? "" },
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <FilterBar
        availableSources={sources}
        filters={filters}
        setFilters={setFilters}
        updateURL={false}
      />
      {/* Slider */}
      <div className="flex items-center gap-2 px-4 py-2">
        <label className="text-sm font-medium">Similarity Threshold:</label>
        <input
          type="range"
          min={0}
          max={4}
          step={0.05}
          value={similarityThreshold}
          onChange={(e) => {
            setSimilarityThreshold(parseFloat(e.target.value));
          }}
          className="w-64"
        />
        <span className="w-12 text-right text-sm">
          {similarityThreshold.toFixed(2)}
        </span>
      </div>

      {/* Graph */}
      <div className="flex-1 bg-white">
        <ForceGraph2D
          d3VelocityDecay={0.5}
          ref={fgRef}
          graphData={filteredGraphData}
          width={window.innerWidth * 0.5}
          height={window.innerHeight - 150}
          nodeLabel="label"
          linkLabel={"similarity"}
          nodeAutoColorBy="category"
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={(d) => d.similarity * 0.01}
          linkDirectionalParticleWidth={(d) => d.similarity * 1.5}
          linkWidth={(d) => d.similarity * 1.5}
          onNodeClick={async (node) => {
            console.log("Clicked node:", node);
            await linkToDocument(node.id);
          }}
        />
      </div>
    </div>
  );
}

function RouteComponent() {
  const { graphType, graphData, selectedDoc, sources, categories } =
    Route.useLoaderData();

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
    <div className="flex h-[calc(100dvh-64px)] bg-white">
      <div className="m-4 w-1/2 overflow-y-hidden border-r border-gray-200">
        <h1 className="mb-4 text-2xl font-semibold">Knowledge Graph</h1>
        <div className="flex border-b border-gray-200 pb-4">
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

        <KnowledgeGraph
          graphType={graphType}
          graphData={graphData}
          sources={sources}
          categories={categories}
        />
      </div>
      <div className="w-1/2 border-r border-gray-200">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
