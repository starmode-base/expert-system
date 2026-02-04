import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isArticle,
  labelBookmarks,
  LabeledArticle,
} from "../src/x-client/x-sdk/tweet-utils";
import type { XBookmarksResponse } from "../src/x-client/x-sdk/bookmarks";

interface CachedBookmarks {
  cachedAt: string;
  response: XBookmarksResponse;
}

const cachePath = path.join(
  process.cwd(),
  ".cache",
  "x-bookmarks-folder-get.json",
);

const apiKey = "new1_8497d0cb00074d729cbbf4cd9a00e402";

const raw = await fs.readFile(cachePath, "utf8");
const cached = JSON.parse(raw) as CachedBookmarks;
const response = cached.response;

const labeled = labelBookmarks(response);
const labeledArticles = labeled.filter(
  (item): item is LabeledArticle => item.type === "article",
);

const articleTweetIds =
  response.data?.filter(isArticle).map((tweet) => tweet.id) ?? [];

if (labeledArticles.length === 0 || articleTweetIds.length === 0) {
  process.exit(0);
}

for (const tweetId of articleTweetIds) {
  const url = new URL("https://api.twitterapi.io/twitter/article");
  url.searchParams.set("tweet_id", tweetId);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  const text = await res.text();
  console.log(text);
}
