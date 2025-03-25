import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/knowledge-graph/")({
  beforeLoad: () => {
    return redirect({
      to: "/knowledge-graph/$graphType/$documentid",
      params: { graphType: "topic", documentid: "none" },
    });
  },
});
