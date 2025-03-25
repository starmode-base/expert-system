import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/knowledge-graph")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>"Hello /knowledge-graph"</div>;
}
