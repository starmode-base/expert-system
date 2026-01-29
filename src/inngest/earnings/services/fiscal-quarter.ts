import type { FiscalQuarter } from "../types";

/**
 * Parses report date and fiscal year end to determine the fiscal year and quarter.
 *
 * The algorithm:
 * 1. Find the most recent fiscal year end date that is on or before the report date
 * 2. Calculate quarter ends by working backwards from that fiscal year end
 * 3. Determine which quarter the report date falls into
 *
 * @param args - The report date and fiscal year end
 * @returns The fiscal year and quarter (1-4)
 */
export function parseFiscalQuarter(args: {
  reportDate: Date;
  fiscalYearEnd: Date;
}): FiscalQuarter {
  const { reportDate, fiscalYearEnd } = args;
  const fyeMonth = fiscalYearEnd.getUTCMonth();
  const fyeDay = fiscalYearEnd.getUTCDate();

  // Find the fiscal year end for this report date
  // Use the one in the report year if it's already passed, otherwise use prior year
  const fiscalYearEndForReport = (() => {
    const candidate = new Date(
      Date.UTC(reportDate.getUTCFullYear(), fyeMonth, fyeDay),
    );
    return candidate <= reportDate
      ? candidate
      : new Date(Date.UTC(reportDate.getUTCFullYear() - 1, fyeMonth, fyeDay));
  })();

  // Calculate quarter end dates working backwards from fiscal year end
  // Q4 = fiscalYearEnd, Q3 = fiscalYearEnd - 3 months, etc.
  const quarterEnds = [0, 3, 6, 9].map(
    (offset) =>
      new Date(
        Date.UTC(
          fiscalYearEndForReport.getUTCFullYear(),
          fiscalYearEndForReport.getUTCMonth() - offset,
          fiscalYearEndForReport.getUTCDate(),
        ),
      ),
  );

  // Find which quarter the report date falls into
  const quarterIndex = quarterEnds.findIndex((qEnd) => reportDate >= qEnd);

  return {
    year: fiscalYearEndForReport.getUTCFullYear(),
    quarter: 4 - quarterIndex,
  };
}
