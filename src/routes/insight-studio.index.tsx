import { createFileRoute } from "@tanstack/react-router";
import { InsightCreator } from "~/components/insight-studio/insight-creator";

import { listOrganizationsSF } from "~/server/organizations";
import {
  vectorConceptSearchTimeWeightedSF,
  vectorTakeawaySearchTimeWeightedSF,
} from "~/server/queries";

export const Route = createFileRoute("/insight-studio/")({
  component: RouteComponent,
  loader: async () => {
    const { viewerId } = await listOrganizationsSF();

    const similarTakeaways = await vectorTakeawaySearchTimeWeightedSF({
      data: { query: "autonomous vehicles" },
    });
    const similarConcepts = await vectorConceptSearchTimeWeightedSF({
      data: { query: "autonomous vehicles" },
    });

    return { viewerId, similarTakeaways, similarConcepts };
  },
});

function RouteComponent() {
  const { similarTakeaways, similarConcepts } = Route.useLoaderData();
  return (
    <InsightCreator
      similarTakeaways={similarTakeaways}
      similarConcepts={similarConcepts}
    />
  );
}
