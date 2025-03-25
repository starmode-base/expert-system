import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/knowledge-graph/")({
  beforeLoad: () => {
    return redirect({
      to: "/knowledge-graph/$documentid",
      params: { documentid: "none" },
    });
  },
});
