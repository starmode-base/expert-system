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
      data: { query: "What are the key takeaways from the article?" },
    });
    const similarConcepts = await vectorConceptSearchTimeWeightedSF({
      data: { query: "test" },
    });

    return { viewerId, similarTakeaways, similarConcepts };
  },
});

function RouteComponent() {
  return <InsightCreator placeholder="Enter your insight prompt..." />;
}
