import { inngest } from "../client";

await inngest.send({
  name: "scraper/daily.scraper",
  user: {
    id: "spencer",
    email: "K5o6w@example.com",
  },
});

console.log("Done");
