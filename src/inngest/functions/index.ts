import { earningsCallsScraper } from "./earnings-calls-scraper";
import { generateInsight } from "./generate-insight";
import { generateTakeaways } from "./generate-takeaways";
import { helloWorld } from "./hello-world";
import { processEarningsJobs } from "./process-earnings-jobs";
import { scienceDailyScraper } from "./science-daily-scraper";
import { syncEarningsCalendar } from "./sync-earnings-calendar";

export const inngestFunctions = [
  helloWorld,
  scienceDailyScraper,
  earningsCallsScraper,
  generateTakeaways,
  generateInsight,
  syncEarningsCalendar,
  processEarningsJobs,
];
