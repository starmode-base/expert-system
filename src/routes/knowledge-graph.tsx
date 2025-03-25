import { createFileRoute } from "@tanstack/react-router";
import { buildTakewayGraph } from "~/server/build-graph";
import ForceGraph2D from "react-force-graph-2d";

export const Route = createFileRoute("/knowledge-graph")({
  loader: async () => {
    const takeawayGraph = await buildTakewayGraph();

    return { takeawayGraph };
  },
  component: RouteComponent,
});

interface GraphData {
  nodes: { id: string; label: string }[];
  links: { source: string; target: string; similarity: number }[];
}

function KnowledgeGraph({ graphData }: { graphData: GraphData }) {
  console.log("graphData", graphData);
  return (
    <ForceGraph2D
      graphData={graphData}
      nodeLabel="label"
      linkLabel={"similarity"}
      // nodeAutoColorBy="id"
      linkDirectionalParticles={1}
      linkDirectionalParticleSpeed={(d) => d.similarity * 0.01}
      linkDirectionalParticleWidth={(d) => d.similarity}
      linkWidth={(d) => d.similarity}
      onNodeClick={(node, event) => {
        event.stopPropagation();
        console.log("Clicked node:", node);
      }}
    />
  );
}

function RouteComponent() {
  const { takeawayGraph } = Route.useLoaderData();
  return (
    <div className="flex h-screen">
      <h1 className="mb-4 text-2xl font-semibold">Knowledge Graph</h1>
      <KnowledgeGraph graphData={takeawayGraph} />
    </div>
  );
}
