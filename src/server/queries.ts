import { createServerFn } from "@tanstack/react-start";
import { db } from "../postgres/db";
import { DocumentSelect, TakeawaySelect } from "~/postgres/schema";

export type DocumentSelectWithTakeaways = DocumentSelect & {
  takeaways: TakeawaySelect[];
};

export const queryDocuments = createServerFn({
  method: "GET",
}).handler(async () => {
  const documents = await db.query.documents.findMany({
    with: {
      takeaways: true,
    },
  });

  return documents;
});
