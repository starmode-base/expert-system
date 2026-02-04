import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  beforeLoad: () => {
    return redirect({
      to: "/settings/importer",
    });
  },
});
