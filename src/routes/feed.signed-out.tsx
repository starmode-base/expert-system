import { createFileRoute } from "@tanstack/react-router";
import { SignedOutExperience } from "~/components/signed-out";
import { queryPublicInsightsFeed } from "~/server/queries";

export const Route = createFileRoute("/feed/signed-out")({
  loader: async () => {
    try {
      const items = await queryPublicInsightsFeed();
      return { items, error: null as string | null };
    } catch (e) {
      return {
        items: [],
        error: e instanceof Error ? e.message : "Failed to load insights",
      };
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { items, error } = Route.useLoaderData();

  return <SignedOutExperience items={items} error={error} />;
}
