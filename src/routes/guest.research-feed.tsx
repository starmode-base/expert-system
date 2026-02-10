import { createFileRoute } from "@tanstack/react-router";
import { SignedOutExperience } from "~/components/signed-out";
import { queryPublicInsightsFeedPaginated } from "~/server/queries";

export const Route = createFileRoute("/guest/research-feed")({
  loader: async () => {
    const page = await queryPublicInsightsFeedPaginated({
      data: { cursor: null, limit: 10 },
    });
    return { page };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { page } = Route.useLoaderData();

  return <SignedOutExperience initialPage={page} />;
}
