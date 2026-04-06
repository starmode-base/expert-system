import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dev/")({
  beforeLoad: () => {
    return redirect({ to: "/dev/scrape" });
  },
});
