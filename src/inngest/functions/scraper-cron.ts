import { inngest } from "../client";

export const dailyScraper = inngest.createFunction(
  { id: "daily.scraper" },
  { cron: "TZ=America/Phoenix 0 7 * * *" },
  async ({ step }) => {
    await step.sendEvent("test/scraper", {
      name: "app/scraper",
      user: {
        id: "spencer",
        email: "K5o6w@example.com",
      },
    });

    console.log("Done");
  },
);
