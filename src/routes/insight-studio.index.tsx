import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/insight-studio/")({
  beforeLoad: () => {
    return redirect({
      to: "/insight-studio/$insightId",
      params: { insightId: "none" },
    });
  },
});
