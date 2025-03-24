import { inngest } from "../client";

await inngest.send({
  name: "scraper/daily.scraper",
  user: {
    id: "starmode-sworks",
    email: "K5o6w@example.com",
  },
});

console.log("Done");
