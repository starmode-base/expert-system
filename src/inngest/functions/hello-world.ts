import { publishNotifyUI } from "~/lib/ably";
import { inngest } from "../client";
import { makeBedtimeStoryLLM } from "../steps/hello-world";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    /**
     * Step 1: Sleep for a moment
     */
    await step.sleep("wait-a-moment", "1s");

    /**
     * Step 2: Make an animal story
     */
    const bedtimeStory = await step.run(
      "make-bedtime-story",
      makeBedtimeStoryLLM,
      event.data.animal,
    );

    /**
     * Step 3: Publish the bedtime story to the Ably channel
     */
    await step.run(
      "publish-invalidate",
      publishNotifyUI,
      event.user.id,
      bedtimeStory,
    );

    return bedtimeStory;
  },
);
