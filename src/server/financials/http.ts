import { z } from "zod";
import { authorizeApiRequest } from "~/server/quota";
import { FinancialApiError, invalidFinancialRequest } from "./errors";
import type { FinancialPeriod } from "./normalize";

const periodSchema = z.enum(["quarterly", "annual"]);
const limitSchema = z.coerce.number().int().min(1).max(40);

interface ParsedFinancialQuery {
  period: FinancialPeriod;
  limit: number;
  includeProvenance: boolean;
}

function financialJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function zodIssueMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const location = issue.path.join(".");
      return location ? `${location}: ${issue.message}` : issue.message;
    })
    .join(", ");
}

export function parseFinancialQuery(
  request: Request,
  options: { includeLimit?: boolean; includeProvenance?: boolean } = {},
): ParsedFinancialQuery {
  const url = new URL(request.url);
  const parsedPeriod = periodSchema.safeParse(
    url.searchParams.get("period") ?? "quarterly",
  );
  if (!parsedPeriod.success) {
    throw invalidFinancialRequest("period must be quarterly or annual");
  }

  let limit = 8;
  const limitValue = url.searchParams.get("limit");
  if (options.includeLimit && limitValue !== null) {
    const parsedLimit = limitSchema.safeParse(limitValue);
    if (!parsedLimit.success) {
      throw invalidFinancialRequest("limit must be an integer from 1 to 40");
    }
    limit = parsedLimit.data;
  }

  const include = url.searchParams.get("include");
  if (
    options.includeProvenance &&
    include !== null &&
    include !== "provenance"
  ) {
    throw invalidFinancialRequest("include must be provenance");
  }

  return {
    period: parsedPeriod.data,
    limit,
    includeProvenance:
      options.includeProvenance === true && include === "provenance",
  };
}

function financialErrorResponse(error: unknown): Response {
  if (error instanceof FinancialApiError) {
    return financialJson(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  console.error("Financial API request failed:", error);
  return financialJson(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    },
    500,
  );
}

export async function runFinancialRoute(
  request: Request,
  handler: () => unknown,
): Promise<Response> {
  const auth = await authorizeApiRequest(request, "financials", {
    structuredErrors: true,
  });
  if (auth.type === "error") return auth.response;

  try {
    return financialJson(await handler());
  } catch (error) {
    return financialErrorResponse(error);
  }
}
