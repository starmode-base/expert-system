import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  beforeLoad: () => {
    return redirect({
      to: "/settings/public-stocks",
      search: { searchInput: undefined },
    });
  },
});
