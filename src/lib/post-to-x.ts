// post-to-x.ts
import { TwitterApi, TwitterApiV2Settings } from "twitter-api-v2";
import { ensureEnv } from "./env";

export async function postToX(text: string, replyLink: string) {
  // Turn on verbose HTTP error details while troubleshooting
  TwitterApiV2Settings.debug = true;
  TwitterApiV2Settings.logger = console;

  // OAuth 1.0a user-context creds (keep these on the server only)
  const appKey = ensureEnv("X_API_KEY");
  const appSecret = ensureEnv("X_API_SECRET");
  const accessToken = ensureEnv("X_ACCESS_TOKEN");
  const accessSecret = ensureEnv("X_ACCESS_SECRET");

  const client = new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });

  const rwClient = client.readWrite; // Ensure we use a client with write permissions

  try {
    const res = await rwClient.v2.tweet(text);
    console.log("Posted:", res.data);

    const replyRes = await rwClient.v2.tweet({
      text: `References @ ${replyLink}`,
      reply: {
        in_reply_to_tweet_id: res.data.id,
      },
    });
    console.log("Replied:", replyRes.data);

    return { post: res.data, reply: replyRes.data };
  } catch (error: unknown) {
    console.error("Tweet failed");

    throw error;
  }
}
