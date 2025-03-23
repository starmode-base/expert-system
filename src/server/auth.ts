import { db } from "~/postgres/db";
import { getAuth } from "@clerk/tanstack-start/server";

/**
 * Get the clerk user id
 */
export async function getClerkUserId(request: Request) {
  const { userId: clerkUserId } = await getAuth(request);

  return clerkUserId;
}

/**
 * Get the viewer (the current user)
 */
export async function getViewerId(request: Request) {
  const clerkUserId = await getClerkUserId(request);

  if (!clerkUserId) {
    return null;
  }

  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.clerkUserId, clerkUserId),
    columns: { id: true },
  });

  if (!userRecord) {
    return null;
  }

  return userRecord.id;
}
