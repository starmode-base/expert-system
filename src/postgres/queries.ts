import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";

export const queryDocuments = createServerFn({
  method: "GET",
}).handler(async () => {
  return db.query.documents.findMany({
    with: {
      takeaways: true,
    },
  });
});
