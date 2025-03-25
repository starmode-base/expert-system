import { createFileRoute } from "@tanstack/react-router";

import { PubSubProvider } from "~/lib/ably";
import { listOrganizationsSF } from "~/server/organizations";

/**
 * Route
 */
export const Route = createFileRoute("/")({
  loader: () => {
    return listOrganizationsSF();
  },
  component: RouteComponentProvider,
});

/**
 * Route component
 */
function RouteComponentProvider() {
  const { viewerId } = Route.useLoaderData();

  return (
    <PubSubProvider viewerId={viewerId}>
      <RouteComponent />
    </PubSubProvider>
  );
}

/**
 * Route component
 */
function RouteComponent() {
  return (
    <div
      className="justify-center_ items-center_ flex h-dvh flex-col gap-8 bg-slate-100 p-8"
      style={{ height: "calc(100vh - 48px)" }}
    >
      <img
        src="/starmode-logo.svg"
        alt="STΛR MODΞ logo"
        className="mx-auto max-w-sm"
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-10">
        <div className="max-w-4xl text-center text-5xl font-semibold text-slate-800 sm:text-7xl">
          Expert-System
        </div>
      </div>
    </div>
  );
}
