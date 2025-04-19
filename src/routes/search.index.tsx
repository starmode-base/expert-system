import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/search/")({
  beforeLoad: () => {
    return redirect({
      to: "/search/$takeawayid",
      params: { takeawayid: "none" },
      search: { searchInput: undefined, filters: undefined },
    });
  },
});
