export type FinancialErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "COMPANY_NOT_FOUND"
  | "METRIC_NOT_FOUND"
  | "METRIC_UNAVAILABLE"
  | "SEC_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class FinancialApiError extends Error {
  constructor(
    public readonly code: FinancialErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FinancialApiError";
  }
}

export function invalidFinancialRequest(message: string): FinancialApiError {
  return new FinancialApiError("INVALID_REQUEST", message, 400);
}
