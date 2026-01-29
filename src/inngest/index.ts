import { earningsCallsScraper } from "./importers/earnings-calls-scraper";
import { dailyInsight } from "./insights/daily-insight";
import { generateInsight } from "./insights/generate-insight";
import { generateTakeaways } from "./takeaways/generate-takeaways";
import { fedSpeechesScraper } from "./importers/scheduled/fed-speeches";
import { processEarningsJobs } from "./importers/scheduled/public-earnings/process-earnings-jobs";
import { scienceDailyScraper } from "./importers/unused/science-daily-scraper";
import { stratecheryScraper } from "./importers/scheduled/stratechery";
import { syncEarningsCalendar } from "./importers/scheduled/sync-earnings-calendar";
import { dwarkeshPodcastScraper } from "./importers/scheduled/dwarkesh/dwarkesh-job";
import { macroVoicesScraper } from "./importers/scheduled/macrovoices/macrovoices-job";
import { a16zNewsScraper } from "./importers/scheduled/a16z/a16z-job";
import { dailyXPost } from "./post-to-x/daily-x-post";

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
  dwarkeshPodcastScraper,
  macroVoicesScraper,
  a16zNewsScraper,
  dailyXPost,
];
