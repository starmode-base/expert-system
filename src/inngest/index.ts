import { dailyInsight } from "./insights/daily-insight";
import { generateInsight } from "./insights/generate-insight";
import { generateTakeaways } from "./takeaways/generate-takeaways";
import { fedSpeechesScraper } from "./importers/scheduled/fed-speeches";
import { scienceDailyScraper } from "./importers/unused/science-daily-scraper";
import { dwarkeshPodcastScraper } from "./importers/scheduled/dwarkesh/dwarkesh-job";
import { macroVoicesScraper } from "./importers/scheduled/macrovoices/macrovoices-job";
import { a16zNewsScraper } from "./importers/scheduled/a16z/a16z-job";
import { seedBlogs } from "./importers/scheduled/blogs/seed-blogs";
import { seedSingleFeed } from "./importers/scheduled/blogs/seed-single-feed";
import { scrapeAllBlogs } from "./importers/scheduled/blogs/scrape-all-blogs";
import { scrapeSingleBlog } from "./importers/scheduled/blogs/scrape-single-blog";

// Earnings call functions (refactored)
import {
  syncEarningsCalendar,
  processEarningsJobs,
  fetchTranscripts,
} from "./earnings";
import { backfillCompanyOverviews } from "./stock-data/backfill-company-overviews";

export const inngestFunctions = [
  scienceDailyScraper,
  fetchTranscripts,
  generateTakeaways,
  generateInsight,
  syncEarningsCalendar,
  processEarningsJobs,
  fedSpeechesScraper,
  dailyInsight,
  dwarkeshPodcastScraper,
  macroVoicesScraper,
  a16zNewsScraper,
  seedBlogs,
  seedSingleFeed,
  scrapeAllBlogs,
  scrapeSingleBlog,
  backfillCompanyOverviews,
];
