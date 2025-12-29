import { earningsCallsScraper } from "./importers/earnings-calls-scraper";
import { dailyInsight } from "./insights/daily-insight";
import { generateInsight } from "./insights/generate-insight";
import { generateTakeaways } from "./takeaways/generate-takeaways";
import { fedSpeechesScraper } from "./importers/scheduled/fed-speeches";
import { processEarningsJobs } from "./importers/scheduled/process-earnings-jobs";
import { scienceDailyScraper } from "./importers/unused/science-daily-scraper";
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
  fedSpeechesScraper,
  dailyInsight,
];
