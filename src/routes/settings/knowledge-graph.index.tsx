import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/knowledge-graph/")({
  beforeLoad: () => {
    return redirect({
      to: "/settings/knowledge-graph/$graphType/$documentid",
      params: { graphType: "topic", documentid: "none" },
    });
  },
});
