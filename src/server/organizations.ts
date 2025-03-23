import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "~/postgres/db";
import { invariant } from "@tanstack/react-router";
import { Id } from "./schema";
import { authMiddleware } from "../middleware/auth-middleware";

/**
 * Organization name schema
 */
export const OrganizationName = z.string().min(1);
export type OrganizationName = z.infer<typeof OrganizationName>;

/**
 * Create an organization
 *
 * Any user can create an organization
 */
export const createOrganizationSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(OrganizationName)
  .handler(async ({ data, context }) => {
    const organizationId = await db.transaction(async (tx) => {
      // Create organization
      const organizationId = await tx
        .insert(schema.organizations)
        .values({ name: data })
        .returning({ id: schema.organizations.id })
        .then(([organization]) => organization?.id);

      invariant(organizationId, "Failed to create organization");

      // Make viewer a member of the organization
      await tx.insert(schema.organizationMembers).values({
        organizationId,
        userId: context.viewer.id,
      });

      return organizationId;
    });

    return organizationId;
  });

/**
 * Update organization input schema
 */
export const UpdateOrganizationSFInput = z.object({
  id: Id,
  name: OrganizationName,
});

/**
 * Update an organization
 *
 * The viewer must be a _member_ of the organization
 */
export const updateOrganizationSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(UpdateOrganizationSFInput)
  .handler(async ({ data: { id: organizationId, name }, context }) => {
    context.ensureMemberOf(organizationId);

    await db
      .update(schema.organizations)
      .set({ name })
      .where(eq(schema.organizations.id, organizationId));
  });

/**
 * Delete an organization
 *
 * The viewer must be a _member_ of the organization
 */
export const deleteOrganizationSF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(Id)
  .handler(async ({ data: organizationId, context }) => {
    context.ensureMemberOf(organizationId);

    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));
  });

/**
 * Get an organization
 *
 * Only organizations where the viewer is a _member_ are returned
 */
export const getOrganizationSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(Id)
  .handler(async ({ data: organizationId, context }) => {
    return await db.query.organizations.findFirst({
      where: (organizations, { eq, and, inArray }) =>
        and(
          eq(organizations.id, organizationId),
          inArray(organizations.id, context.viewer.memberOf),
        ),
    });
  });

/**
 * List all organizations
 *
 * Only organizations where the viewer is a _member_ are returned
 */
export const listOrganizationsSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const organizations = await db.query.organizations.findMany({
      where: (organizations, { inArray }) =>
        inArray(organizations.id, context.viewer.memberOf),
      with: {
        organizationMembers: {
          columns: { userId: true },
        },
      },
      orderBy: (organizations, { asc }) => [
        asc(organizations.name),
        asc(organizations.id),
      ],
    });

    return {
      organizations,
      viewerId: context.viewer.id,
    };
  });
