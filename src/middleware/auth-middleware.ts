import { createMiddleware } from "@tanstack/react-start";
import { getWebRequest } from "vinxi/http";
import { eq } from "drizzle-orm";
import { db, schema } from "~/postgres/db";
import { getSessionUser } from "~/server/auth";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getSessionUser(getWebRequest());
  if (!user?.email) throw new Error("Unauthorized");
  const members = await db
    .select()
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.userId, user.id));
  const viewer = {
    ...user,
    email: user.email,
    memberOf: members.map((m) => m.organizationId),
  };
  const isMemberOf = (id?: string) => !!id && viewer.memberOf.includes(id);
  const ensureMemberOf = (id?: string) => {
    if (!isMemberOf(id)) throw new Error("Unauthorized");
  };
  return next({
    context: { viewer, ensureViewer: () => viewer, isMemberOf, ensureMemberOf },
  });
});
