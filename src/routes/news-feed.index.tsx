import { createFileRoute, redirect } from "@tanstack/react-router";

// export const Route = createFileRoute("/news-feed/")({
//     beforeLoad: ({ params }) => {
//       throw redirect({ to: "/s/$id", params: { id: params.id } });
//     },
//   });

export const Route = createFileRoute("/news-feed/")({
  beforeLoad: () => {
    return redirect({
      to: "/news-feed/$documentid",
      params: { documentid: "none" },
    });
  },
});
