import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { buildTakewayGraph } from "~/server/build-graph";
import ForceGraph2D from "react-force-graph-2d";
import { DocumentContent } from "./news-feed.$documentid";
import { queryDocument } from "~/server/queries";

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
  const navigate = useNavigate();

  return (
    <ForceGraph2D
      graphData={graphData}
      nodeLabel="label"
      linkLabel={"similarity"}
      // nodeAutoColorBy="id"
      linkDirectionalParticles={1}
      linkDirectionalParticleSpeed={(d) => d.similarity * 0.01}
      linkDirectionalParticleWidth={(d) => d.similarity}
      linkWidth={(d) => d.similarity * 1.75}
      onNodeClick={async (node) => {
        console.log("Clicked node:", node);
        await navigate({
          to: `/knowledge-graph/$documentid`,
          params: { documentid: node.id },
        });
        // window.location.href = `/knowledge-graph/${node.id}`;
      }}
    />
  );
}

function RouteComponent() {
  const { takeawayGraph, selectedDoc } = Route.useLoaderData();
  return (
    <div className="flex h-screen">
      <div className="w-2/3 overflow-y-auto border-r border-gray-200 p-4">
        <h1 className="mb-4 text-2xl font-semibold">Knowledge Graph</h1>
        <KnowledgeGraph graphData={takeawayGraph} />
      </div>
      <div className="w-1/3 overflow-y-auto border-r border-gray-200 p-4">
        <DocumentContent selectedDoc={selectedDoc} />
      </div>
    </div>
  );
}
