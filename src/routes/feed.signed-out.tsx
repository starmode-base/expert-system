import { createFileRoute } from "@tanstack/react-router";
import { SignedOutExperience } from "~/components/signed-out";
import { queryPublicInsightsFeed } from "~/server/queries";

export const Route = createFileRoute("/feed/signed-out")({
  loader: async () => {
    return await queryPublicInsightsFeed();
  },
  component: RouteComponent,
});

function RouteComponent() {
  const items = Route.useLoaderData();

  return <SignedOutExperience items={items} />;
}
