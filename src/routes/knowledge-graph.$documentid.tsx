import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { buildTakewayGraph } from "~/server/build-graph";
import ForceGraph2D, {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import { queryDocument } from "~/server/queries";
import { DocumentContent } from "~/components/document-content";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/knowledge-graph/$documentid")({
  loader: async ({ params: { documentid } }) => {
    const takeawayGraph = await buildTakewayGraph();
    const selectedDoc = (await queryDocument({ data: documentid })) ?? null;

    return { takeawayGraph, selectedDoc };
  },
  component: RouteComponent,
});

interface GraphData {
  nodes: { id: string; label: string }[];
  links: { source: string; target: string; similarity: number }[];
}

function KnowledgeGraph({ graphData }: { graphData: GraphData }) {
  console.log("graphData", graphData);
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
    <div className="h-full w-full">
      <ForceGraph2D
        d3VelocityDecay={0.5}
        ref={fgRef}
        graphData={graphData}
        width={window.innerWidth * (1 / 2)}
        height={window.innerHeight - 100}
        nodeLabel="label"
        linkLabel={"similarity"}
        nodeAutoColorBy="tag"
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={(d) => d.similarity * 0.01}
        linkDirectionalParticleWidth={(d) => d.similarity * 2}
        linkWidth={(d) => d.similarity * 1.75}
        onNodeClick={async (node) => {
          console.log("Clicked node:", node);
          await navigate({
            to: `/knowledge-graph/$documentid`,
            params: { documentid: node.id },
          });
        }}
      />
    </div>
  );
}

function RouteComponent() {
  const { takeawayGraph, selectedDoc } = Route.useLoaderData();
  return (
    <div className="flex h-screen" style={{ height: "calc(100vh - 48px)" }}>
      <div className="w-1/2 overflow-y-hidden border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-semibold">Knowledge Graph</h1>
        <KnowledgeGraph graphData={takeawayGraph} />
      </div>
      <div className="w-1/2 border-r border-gray-200">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
