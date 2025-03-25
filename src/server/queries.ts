import { createServerFn } from "@tanstack/react-start";
import { db, schema } from "../postgres/db";
import { DocumentSelect, TakeawaySelect } from "~/postgres/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export type DocumentSelectWithTakeaways = DocumentSelect & {
  takeaways: TakeawaySelect[];
};

export const queryDocuments = createServerFn({
  method: "GET",
}).handler(async () => {
  const documents = await db.query.documents
    .findMany
    // {} TODO: add user and org foreign keys
    ();

  return documents;
});

export const queryDocument = createServerFn({
  method: "GET",
})
  .validator(z.string())
  .handler(async ({ data: documentId }) => {
    const document = await db.query.documents.findFirst({
      where: eq(schema.documents.id, documentId),
      with: {
        takeaways: true,
      },
    });

    return document;
  });
