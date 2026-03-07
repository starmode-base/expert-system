import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "~/postgres/db";
import { authMiddleware } from "~/middleware/auth-middleware";
import type { ApiKeySelect } from "~/postgres/schema";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateApiKey(): Promise<{
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // base64url encode
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const rawKey = `esak_${base64}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 13); // "esak_" (5) + 8 chars

  return { rawKey, keyHash, keyPrefix };
}

// ---------------------------------------------------------------------------
// Internal helper — used by REST routes (not a server function)
// ---------------------------------------------------------------------------

export async function resolveApiKey(
  rawKey: string,
): Promise<{ userId: string } | null> {
  if (!rawKey.startsWith("esak_")) return null;

  const keyHash = await hashApiKey(rawKey);

  const row = await db.query.apiKeys.findFirst({
    where: and(
      eq(schema.apiKeys.keyHash, keyHash),
      isNull(schema.apiKeys.revokedAt),
    ),
    columns: { id: true, userId: true },
  });

  if (!row) return null;

  // Fire-and-forget lastUsedAt update
  void db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.id))
    .catch((err: unknown) => {
      console.error("Failed to update lastUsedAt", err);
    });

  return { userId: row.userId };
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const createApiKeySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().min(1).max(100) }))
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      id: string;
      name: string;
      keyPrefix: string;
      rawKey: string;
      createdAt: Date;
    }> => {
      const { rawKey, keyHash, keyPrefix } = await generateApiKey();

      const [row] = await db
        .insert(schema.apiKeys)
        .values({
          userId: context.viewer.id,
          name: data.name,
          keyHash,
          keyPrefix,
        })
        .returning({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          keyPrefix: schema.apiKeys.keyPrefix,
          createdAt: schema.apiKeys.createdAt,
        });

      if (!row) throw new Error("Failed to create API key");

      return { ...row, rawKey };
    },
  );

export type ApiKeyListItem = Pick<
  ApiKeySelect,
  "id" | "name" | "keyPrefix" | "lastUsedAt" | "revokedAt" | "createdAt"
>;

export const listApiKeysSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ApiKeyListItem[]> => {
    return db.query.apiKeys.findMany({
      where: eq(schema.apiKeys.userId, context.viewer.id),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
    });
  });

export const revokeApiKeySF = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ keyId: z.string() }))
  .handler(async ({ context, data }): Promise<void> => {
    await db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiKeys.id, data.keyId),
          eq(schema.apiKeys.userId, context.viewer.id),
          isNull(schema.apiKeys.revokedAt),
        ),
      );
  });
