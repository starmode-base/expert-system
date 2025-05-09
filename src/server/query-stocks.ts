import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "~/middleware/auth-middleware";
import { db } from "~/postgres/db";

export const queryStocksSF = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    context.ensureViewer();
    const stocks = await db.query.stockSymbols.findMany();
    return stocks;
  });
