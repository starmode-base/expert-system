import type { z } from "zod";
import { FinancialApiError } from "~/server/financials/errors";
import { enforceApiQuota, type ApiEndpoint } from "~/server/quota";

/** JSON-domain result shared by transports; only adapters construct HTTP responses. */
export interface OperationResult {
  body: unknown;
  status: number;
  headers?: Record<string, string>;
}

export function result(body: unknown, status = 200): OperationResult {
  return { body, status };
}

export class OperationError extends Error {
  constructor(public readonly result: OperationResult) {
    super("Public API operation failed");
  }
}

export function invalidInput(message: string, structured = false): never {
  throw new OperationError(
    result(
      { error: structured ? { code: "INVALID_REQUEST", message } : message },
      400,
    ),
  );
}

export function issueMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(", ");
}

export interface Operation {
  endpoint: ApiEndpoint;
  structuredErrors?: boolean;
  prepare: (
    input: Record<string, unknown>,
  ) => () => OperationResult | Promise<OperationResult>;
}

export async function responseResult(
  response: Response,
): Promise<OperationResult> {
  const body: unknown = await response.json();
  return {
    body,
    status: response.status,
    headers: Object.fromEntries(response.headers),
  };
}

/** Identity is already authenticated. Validation must complete before charging. */
export async function runOperation(
  operation: Operation,
  userId: string,
  input: Record<string, unknown>,
): Promise<OperationResult> {
  let outcome: OperationResult;
  try {
    const execute = operation.prepare(input);
    const quota = operation.structuredErrors
      ? await enforceApiQuota(userId, operation.endpoint, {
          structuredErrors: true,
        })
      : await enforceApiQuota(userId, operation.endpoint);
    if (quota.type === "error") return await responseResult(quota.response);
    outcome = await execute();
  } catch (error) {
    if (error instanceof OperationError) outcome = error.result;
    else if (error instanceof FinancialApiError) {
      outcome = result(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    } else {
      console.error("Public API operation failed:", error);
      outcome = result(
        {
          error: operation.structuredErrors
            ? { code: "INTERNAL_ERROR", message: "Internal server error" }
            : "Internal server error",
        },
        500,
      );
    }
  }
  if (operation.endpoint === "financials") {
    outcome.headers = {
      ...outcome.headers,
      "Cache-Control": "private, no-store",
    };
  }
  return outcome;
}
