// UNUSED

import { extractRssItems, scrapeLink } from "../scrapers/scientific-daily";
import { inngest } from "../../client";

export const scienceDailyScraper = inngest.createFunction(
  { id: "scraper.daily-science" },
  { event: "scraper/daily-science" },
  async ({ step, event }) => {
    console.log("Scraper started: ", event.data.user);

    // Scrape and save content
    const items = await step.run("get-rss-feed", async () => {
      // ######
      return extractRssItems(
        "https://www.sciencedaily.com/rss/top/technology.xml",
      );
    });

    const documentIds = await Promise.all(
      items.map(async (item) => {
        return await step.run("scrape-link", async () => {
          return scrapeLink(item);
        });
      }),
    );

    await Promise.all(
      documentIds.map(async (documentId) => {
        // If scrapeLink fails, documentId will be undefined
        if (!documentId) {
          return;
        }

        await step.sendEvent("generate-takeaways", {
          name: "app/generate-takeaways",
          data: {
            documentId,
            takeawayPrompt:
              "Focus on takeaways that are relevant on its potential for real impact to peoples lives.",
            model: "gpt-5-mini",
            user: {id: "", email: ""},
          },

        });
      }),
    );

  },
);
