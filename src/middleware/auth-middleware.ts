import { createMiddleware } from "@tanstack/react-start";
import { db, schema } from "~/postgres/db";
import { clerkClient } from "@clerk/tanstack-start/server";
import { invariant } from "@tanstack/react-router";
import { getWebRequest } from "vinxi/http";
import { getClerkUserId } from "../server/auth";

/**
 * Get the clerk user (eg. the clerk user ID and the email address)
 */
const getClerkUser = async (
  clerkUserId: string,
): Promise<{ clerkUserId: string; email: string }> => {
  const client = clerkClient({});

  const clerkUser = await client.users.getUser(clerkUserId);

  const email = clerkUser.primaryEmailAddress?.emailAddress;

  // Users always have an email address since we're using the email address to
  // sign up/in
  invariant(email, "Unauthorized");

  return { clerkUserId, email };
};

/**
 * Upsert viewer - syncs the clerk user to our database
 */
async function upsertViewer(clerkUser: { clerkUserId: string; email: string }) {
  const userId = await db
    .insert(schema.users)
    .values({
      clerkUserId: clerkUser.clerkUserId,
      email: clerkUser.email,
    })
    .onConflictDoUpdate({
      target: [schema.users.clerkUserId],
      set: { email: clerkUser.email },
    })
    .returning({ id: schema.users.id })
    .then(([user]) => user?.id);

  return userId;
}

/**
 * Get the viewer (the current user)
 */
async function getViewer(clerkUserId: string) {
  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.clerkUserId, clerkUserId),
    with: {
      organizationMembers: true,
    },
  });

  if (!userRecord) {
    return null;
  }

  const viewer = {
    id: userRecord.id,
    email: userRecord.email,
    memberOf: userRecord.organizationMembers.map(
      (member) => member.organizationId,
    ),
  };

  return viewer;
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  console.log("🔧 Clerk middleware");

  // Get the clerk user id
  const clerkUserId = await getClerkUserId(getWebRequest());

  // Clerk user must be signed in
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  // Get the viewer
  let viewer = await getViewer(clerkUserId);

  // If the viewer doesn't exist in our database, try to sync it from Clerk
  if (!viewer) {
    // Get the clerk user
    const clerkUser = await getClerkUser(clerkUserId);

    // Sync Clerk user to our database
    await upsertViewer(clerkUser);

    // Get the viewer again
    viewer = await getViewer(clerkUserId);
  }

  // Viewer must exist in our database
  if (!viewer) {
    throw new Error("Unauthorized");
  }

  /**
   * Check if the viewer is a member of the provided organization ID
   */
  const isMemberOf = (organizationId?: string) => {
    if (!organizationId) {
      return false;
    }

    return viewer.memberOf.includes(organizationId);
  };

  /**
   * Verify that the viewer is a member of the provided organization ID and
   * throw an error if they're not
   */
  const ensureMemberOf = (organizationId?: string) => {
    if (!isMemberOf(organizationId)) {
      throw new Error("Unauthorized");
    }
  };

  /**
   * Ensure viewer
   */
  const ensureViewer = () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!viewer) {
      throw new Error("Unauthorized");
    }

    return viewer;
  };

  return await next({
    context: {
      viewer,
      ensureViewer,
      isMemberOf,
      ensureMemberOf,
    },
  });
});
