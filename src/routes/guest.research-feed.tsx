import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/guest/research-feed")({
  beforeLoad: () => {
    throw redirect({
      to: "/takeaway-feed",
      search: { searchInput: undefined, filters: undefined },
    });
  },
});
