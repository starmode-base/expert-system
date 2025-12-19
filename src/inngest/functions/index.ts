import { earningsCallsScraper } from "./importers/earnings-calls-scraper";
import { generateInsight } from "./generate-insight";
import { generateTakeaways } from "./generate-takeaways";
import { processEarningsJobs } from "./importers/scheduled/process-earnings-jobs";
import { scienceDailyScraper } from "./importers/science-daily-scraper";
import { stratecheryScraper } from "./importers/scheduled/stratechery";
import { syncEarningsCalendar } from "./importers/scheduled/sync-earnings-calendar";

export const inngestFunctions = [
  scienceDailyScraper,
  earningsCallsScraper,
  generateTakeaways,
  generateInsight,
  syncEarningsCalendar,
  processEarningsJobs,
  stratecheryScraper,
];
