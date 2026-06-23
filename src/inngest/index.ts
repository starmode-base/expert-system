import { dailyInsight } from "./insights/daily-insight";
import { generateInsight } from "./insights/generate-insight";
import { generateTakeaways } from "./takeaways/generate-takeaways";
import { fedSpeechesScraper } from "./importers/scheduled/fed-speeches";
import { dwarkeshPodcastScraper } from "./importers/scheduled/dwarkesh/dwarkesh-job";
import { macroVoicesScraper } from "./importers/scheduled/macrovoices/macrovoices-job";
import { a16zNewsScraper } from "./importers/scheduled/a16z/a16z-job";

import { scrapeAllBlogs } from "./importers/scheduled/blogs/scrape-all-blogs";
import { scrapeSingleBlog } from "./importers/scheduled/blogs/scrape-single-blog";

import { processEarningsCall, syncEarningsCalls } from "./earnings";
import { backfillCompanyOverviews } from "./stock-data/backfill-company-overviews";
import { fetchCompanyOverviewWorker } from "./stock-data/fetch-company-overview";

export const inngestFunctions = [
  generateTakeaways,
  generateInsight,
  syncEarningsCalls,
  processEarningsCall,
  fedSpeechesScraper,
  dailyInsight,
  dwarkeshPodcastScraper,
  macroVoicesScraper,
  a16zNewsScraper,
  scrapeAllBlogs,
  scrapeSingleBlog,
  backfillCompanyOverviews,
  fetchCompanyOverviewWorker,
];
