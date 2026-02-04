import { dailyInsight } from "./insights/daily-insight";
import { generateInsight } from "./insights/generate-insight";
import { generateTakeaways } from "./takeaways/generate-takeaways";
import { fedSpeechesScraper } from "./importers/scheduled/fed-speeches";
import { scienceDailyScraper } from "./importers/unused/science-daily-scraper";
import { stratecheryScraper } from "./importers/scheduled/stratechery";
import { dwarkeshPodcastScraper } from "./importers/scheduled/dwarkesh/dwarkesh-job";
import { macroVoicesScraper } from "./importers/scheduled/macrovoices/macrovoices-job";
import { a16zNewsScraper } from "./importers/scheduled/a16z/a16z-job";

// Earnings call functions (refactored)
import {
  syncEarningsCalendar,
  processEarningsJobs,
  fetchTranscripts,
} from "./earnings";

export const inngestFunctions = [
  scienceDailyScraper,
  fetchTranscripts,
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
];
