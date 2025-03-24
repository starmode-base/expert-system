import { scrapeRSSFeed } from "../steps/scrapers/scientific-daily";
import { inngest } from "../client";

export const dailyScraper = inngest.createFunction(
  { id: "daily.scraper" },
  { cron: "TZ=America/Phoenix 0 7 * * *" },
  async ({ step }) => {
    // Your task logic here
    await step.run("science-daily-tech", async () => {
      await scrapeRSSFeed(
        "https://www.sciencedaily.com/rss/top/technology.xml",
      );
    });
  },
);
