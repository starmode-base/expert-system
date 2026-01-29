import type { EarningsScheduleSelect } from "~/postgres/schema";

interface FiscalQuarter {
  year: number;
  quarter: number;
}

export interface PendingJob {
  id: string;
  earningsSchedule: EarningsScheduleSelect;
}

export type JobResult =
  | { success: true; documentId: string; jobId: string }
  | { success: false; error: string };

export const earningsCallTakeawayPrompt = `
  Focus on articulating the most notable insight that can be drawn about markets, the economy, new technologies, consumer demand or the business environment at large. Only include financial performance of the company to the extent that it supports insights about any of the afore mentioned themes.
  - The takeaway itself should NOT be earnings results or financial performance.
`;

/**
 * Parses report date and fiscal year end to determine year and quarter.
 *
 * @param args - The report date and fiscal year end.
 * @returns The year and quarter.
 */
export const parseFiscalQuarter = (args: {
  reportDate: Date;
  fiscalYearEnd: Date;
}): FiscalQuarter => {
  const { reportDate, fiscalYearEnd } = args;
  const fyeMonth = fiscalYearEnd.getUTCMonth();
  const fyeDay = fiscalYearEnd.getUTCDate();

  const fiscalYearEndForReport = (() => {
    const candidate = new Date(
      Date.UTC(reportDate.getUTCFullYear(), fyeMonth, fyeDay),
    );
    return candidate <= reportDate
      ? candidate
      : new Date(Date.UTC(reportDate.getUTCFullYear() - 1, fyeMonth, fyeDay));
  })();

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

  const quarterIndex = quarterEnds.findIndex((qEnd) => reportDate >= qEnd);

  return {
    year: fiscalYearEndForReport.getUTCFullYear(),
    quarter: 4 - quarterIndex,
  };
};
