import { authenticateApiRequest } from "~/server/quota";
import {
  invalidInput,
  OperationError,
  runOperation,
  type Operation,
} from "./operation";

/** Preserve first-value query semantics for repeated REST parameters. */
export function queryInput(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [key, params.get(key)]),
  );
}

export async function jsonInput(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    invalidInput("Invalid JSON body", true);
  }
  // Let the operation's existing schema report non-object bodies as before.
  return { body };
}

export async function runRestOperation(
  request: Request,
  operation: Operation,
  decode: () => Record<string, unknown> | Promise<Record<string, unknown>>,
): Promise<Response> {
  const auth = operation.structuredErrors
    ? await authenticateApiRequest(request, { structuredErrors: true })
    : await authenticateApiRequest(request);
  if (auth.type === "error") return auth.response;
  // Decoding belongs before quota, including JSON syntax errors.
  try {
    const outcome = await runOperation(operation, auth.userId, await decode());
    return Response.json(outcome.body, {
      status: outcome.status,
      headers: outcome.headers,
    });
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    return Response.json(error.result.body, {
      status: error.result.status,
      headers:
        operation.endpoint === "financials"
          ? { "Cache-Control": "private, no-store" }
          : undefined,
    });
  }
}
