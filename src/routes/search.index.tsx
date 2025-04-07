import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/search/")({
  beforeLoad: () => {
    return redirect({
      to: "/search/$documentid",
      params: { documentid: "none" },
    });
  },
});
