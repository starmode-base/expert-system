import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useConnectionStateListener } from "ably/react";
import { useState } from "react";
import { z } from "zod";
import { inngest } from "~/inngest/client";
import { PubSubProvider, useNotifyUI } from "~/lib/ably";
import { authMiddleware } from "~/middleware/auth-middleware";
import {
  createOrganizationSF,
  listOrganizationsSF,
} from "~/server/organizations";

/**
 * Aggregate server function for this route
 */
const sendEventSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ animal: z.string() }))
  .handler(async ({ context, data }) => {
    await inngest.send({
      name: "test/hello.world",
      data: {
        animal: data.animal,
      },
      user: {
        id: context.viewer.id,
        email: context.viewer.email,
      },
    });

    return context.viewer.email;
  });

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
  const { organizations, viewerId } = Route.useLoaderData();
  const router = useRouter();
  const createOrganization = useServerFn(createOrganizationSF);
  const sendEvent = useServerFn(sendEventSF);
  const [story, setStory] = useState("");

  // https://ably.com/docs/getting-started/react#useConnectionStateListener
  useConnectionStateListener("connected", (stateChange) => {
    console.log("Ably connection state:", stateChange.current);
  });

  useNotifyUI(viewerId, (message) => {
    console.log("message", message);
    setStory(message.data as string);
  });

  return (
    <div className="p-2">
      <div className="flex items-center gap-2">
        Organizations
        <button
          onClick={async () => {
            await createOrganization({ data: "My Org" });
            await router.invalidate();
          }}
          className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
        >
          Add org
        </button>
        <button
          onClick={async () => {
            const res = await sendEvent({ data: { animal: "unicorn" } });
            console.log(res);
          }}
          className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
        >
          Make a bedtime story about a unicorn
        </button>
        <button
          onClick={async () => {
            const res = await sendEvent({ data: { animal: "dog" } });
            console.log(res);
          }}
          className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-white"
        >
          Make a bedtime story about a dog
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {organizations.map((org) => (
          <div key={org.id}>{org.name}</div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div>Story:</div>
        <div>{story}</div>
      </div>
    </div>
  );
}
