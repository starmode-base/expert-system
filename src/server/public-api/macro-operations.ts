import { listFredSeries } from "~/server/fred-data-api/catalog";
import { getFredObservationBatch } from "~/server/fred-data-api/service";
import { macroRequestSchema } from "./macro-schema";
import {
  invalidInput,
  issueMessage,
  result,
  type Operation,
} from "./operation";

export const macroSeries: Operation = {
  endpoint: "macro.series",
  structuredErrors: true,
  prepare(input) {
    if (input.query !== undefined && typeof input.query !== "string")
      invalidInput("query must be a string", true);
    const query = input.query;
    return () => result({ items: listFredSeries(query) });
  },
};
export const macroObservations: Operation = {
  endpoint: "macro.observations",
  structuredErrors: true,
  prepare(input) {
    const parsed = macroRequestSchema.safeParse(input.body);
    if (!parsed.success) invalidInput(issueMessage(parsed.error), true);
    return async () => {
      const response = await getFredObservationBatch(parsed.data.series);
      if (response.items.length === 0 && response.errors.length > 0) {
        return result(
          {
            error: {
              code: "FRED_UNAVAILABLE",
              message: "FRED data is temporarily unavailable",
            },
            ...response,
          },
          502,
        );
      }
      return result(response);
    };
  },
};
