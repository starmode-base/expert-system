import { inngest } from "../client";

await inngest.send({
  name: "app/scraper",
  user: {
    id: "spencer",
    email: "K5o6w@example.com",
  },
});

console.log("Done");
