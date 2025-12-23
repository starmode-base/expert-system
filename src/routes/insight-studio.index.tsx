import { createFileRoute } from "@tanstack/react-router";
import { InsightCreator } from "~/components/insight-studio/insight-creator";

import { listOrganizationsSF } from "~/server/organizations";

export const Route = createFileRoute("/insight-studio/")({
  component: RouteComponent,
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();

    return { viewerId };
  },
});

function RouteComponent() {
  return <InsightCreator />;
}
