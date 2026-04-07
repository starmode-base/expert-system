import { createFileRoute } from "@tanstack/react-router";
import { InsightCreator } from "~/components/insight-studio/insight-creator";

import { listOrganizationsSF } from "~/server/organizations";

export const Route = createFileRoute("/dev/insight-studio/")({
  component: RouteComponent,
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();

    return { viewerId };
  },
});

function RouteComponent() {
  return (
    <div className="flex h-[calc(100dvh-64px-49px)] w-full overflow-hidden bg-white">
      <div className="flex h-full min-w-0 flex-1">
        <InsightCreator />
      </div>
    </div>
  );
}
