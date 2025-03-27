import { earningsCallsScraper } from "./earnings-calls-scraper";
import { generateTakeaways } from "./generate-takeaways";
import { helloWorld } from "./hello-world";
import { scienceDailyScraper } from "./science-daily-scraper";

export const inngestFunctions = [
  helloWorld,
  scienceDailyScraper,
  earningsCallsScraper,
  generateTakeaways,
];
